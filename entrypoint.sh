#!/bin/bash
set -e

cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-http://localhost:8080}"
APP_TAG="${APP_TAG:-dev}"

echo "=== Waiting for app at $BASE_URL ==="
for i in $(seq 1 36); do
    if curl -sf --max-time 5 "$BASE_URL/products" > /dev/null 2>&1; then
        echo "App is ready"
        break
    fi
    if [ "$i" -eq 36 ]; then
        echo "App not ready after 3 minutes"
        exit 1
    fi
    echo "attempt $i/36, retrying in 5s..."
    sleep 5
done

mkdir -p reports

echo "=== Smoke Tests (tag=$APP_TAG, url=$BASE_URL) ==="
k6 run \
    --env BASE_URL="$BASE_URL" \
    --env APP_TAG="$APP_TAG" \
    --env REPORT_FILE="reports/smoke.txt" \
    smoke.js
SMOKE_EXIT=$?
echo "=== Smoke Tests done (exit $SMOKE_EXIT) ==="

echo "=== Load Tests ==="
k6 run \
    --env BASE_URL="$BASE_URL" \
    --env APP_TAG="$APP_TAG" \
    --env REPORT_FILE="reports/load.txt" \
    load.js
LOAD_EXIT=$?
echo "=== Load Tests done (exit $LOAD_EXIT) ==="

# Combine into a single report file named by tag
REPORT="reports/${APP_TAG}.txt"
{
    echo "======================================"
    echo " Test Report: ${APP_TAG}"
    echo " Date: $(date -u)"
    echo " Base URL: ${BASE_URL}"
    echo "======================================"
    echo ""
    [ -f reports/smoke.txt ] && cat reports/smoke.txt || echo "(smoke report missing)"
    echo ""
    [ -f reports/load.txt ]  && cat reports/load.txt  || echo "(load report missing)"
    echo ""
    if [ $SMOKE_EXIT -eq 0 ] && [ $LOAD_EXIT -eq 0 ]; then
        echo "RESULT: PASSED"
    else
        echo "RESULT: FAILED (smoke=$SMOKE_EXIT load=$LOAD_EXIT)"
    fi
} > "$REPORT"

echo "=== Pushing test report to repo ==="
git config user.email "ci@gameclustering.com"
git config user.name "Tarantula CI"
git add reports/
git diff --cached --quiet || git commit -m "report: ${APP_TAG}"
git push origin master

echo "=== Report pushed: $REPORT ==="

[ $SMOKE_EXIT -eq 0 ] && [ $LOAD_EXIT -eq 0 ] || exit 1
echo "=== All tests PASSED ==="
