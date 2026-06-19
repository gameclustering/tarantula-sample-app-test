#!/bin/bash
set -e

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "=== Smoke Tests (BASE_URL=$BASE_URL) ==="
k6 run --env BASE_URL="$BASE_URL" smoke.js
echo "=== Smoke Tests PASSED ==="

echo "=== Load Tests ==="
k6 run --env BASE_URL="$BASE_URL" load.js
echo "=== Load Tests PASSED ==="

echo "=== All tests PASSED ==="
