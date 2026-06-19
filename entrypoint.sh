#!/bin/bash
set -e

cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "=== Waiting for app at $BASE_URL ==="
for i in $(seq 1 36); do
    if curl -sf --max-time 5 "$BASE_URL/actuator/health" > /dev/null 2>&1; then
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

echo "=== Smoke Tests (BASE_URL=$BASE_URL) ==="
k6 run --env BASE_URL="$BASE_URL" smoke.js
echo "=== Smoke Tests PASSED ==="

echo "=== Load Tests ==="
k6 run --env BASE_URL="$BASE_URL" load.js
echo "=== Load Tests PASSED ==="

echo "=== All tests PASSED ==="
