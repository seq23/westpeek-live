#!/usr/bin/env bash
set -u -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

mkdir -p logs/local-playwright-gauntlet
RUN_ID="$(date +%Y%m%d_%H%M%S)"
LOG_DIR="logs/local-playwright-gauntlet/$RUN_ID"
mkdir -p "$LOG_DIR"

BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:3000}"
NODE_HEAP="${NODE_OPTIONS:---max-old-space-size=3072}"
export NODE_OPTIONS="$NODE_HEAP"
export PLAYWRIGHT_BASE_URL="$BASE_URL"
export PLAYWRIGHT_HEADED="${PLAYWRIGHT_HEADED:-1}"
export PLAYWRIGHT_RETRIES="${PLAYWRIGHT_RETRIES:-1}"
export PLAYWRIGHT_DISABLE_VIDEO="${PLAYWRIGHT_DISABLE_VIDEO:-0}"
export LOCAL_PLAYWRIGHT_GAUNTLET_AUTH="${LOCAL_PLAYWRIGHT_GAUNTLET_AUTH:-true}"
# Local headed gauntlet runs a production Next server from a temporary ZIP unpack.
# It must not require real database credentials or mutate production data.
# Explicitly force the local file runtime store for this E2E-only process so
# protected producer/sponsor/crew surfaces render real operational UI instead of
# generic digest/500 pages caused by missing production persistence config.
export AGENCY_EVENT_OS_RUNTIME_STORE="${AGENCY_EVENT_OS_RUNTIME_STORE:-file}"
export ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION="${ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION:-true}"
export AGENCY_EVENT_OS_RUNTIME_STORE_PATH="${AGENCY_EVENT_OS_RUNTIME_STORE_PATH:-$ROOT_DIR/.runtime-data/local-playwright-runtime.json}"
export V5_ACCESS_COOKIE_SECRET="${V5_ACCESS_COOKIE_SECRET:-$(node -e "const {day1Default}=require('./scripts/lib/day1AccessDefaults'); process.stdout.write(day1Default('V5_ACCESS_COOKIE_SECRET', 'local-playwright-gauntlet-cookie-secret-1234567890'))")}"
export CREW_ACCESS_PASSWORD="${CREW_ACCESS_PASSWORD:-$(node -e "const {requiredDay1Default}=require('./scripts/lib/day1AccessDefaults'); process.stdout.write(requiredDay1Default('CREW_ACCESS_PASSWORD'))")}"
export EVENT_DEMO_SPEAKER_CODE="${EVENT_DEMO_SPEAKER_CODE:-$(node -e "const {requiredDay1Default}=require('./scripts/lib/day1AccessDefaults'); process.stdout.write(requiredDay1Default('EVENT_DEMO_SPEAKER_CODE'))")}"
export EVENT_DEMO_SPONSOR_CODE="${EVENT_DEMO_SPONSOR_CODE:-$(node -e "const {requiredDay1Default}=require('./scripts/lib/day1AccessDefaults'); process.stdout.write(requiredDay1Default('EVENT_DEMO_SPONSOR_CODE'))")}"
export EVENT_DEMO_VIP_CODE="${EVENT_DEMO_VIP_CODE:-$(node -e "const {requiredDay1Default}=require('./scripts/lib/day1AccessDefaults'); process.stdout.write(requiredDay1Default('EVENT_DEMO_VIP_CODE'))")}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

run_and_log() {
  local name="$1"
  shift
  echo ""
  echo "============================================================"
  echo "$name"
  echo "============================================================"
  echo "COMMAND: $*" | tee "$LOG_DIR/${name}.command.txt"
  "$@" 2>&1 | tee "$LOG_DIR/${name}.log"
  local status=${PIPESTATUS[0]}
  echo "$status" > "$LOG_DIR/${name}.exit"
  return "$status"
}

zip_reports() {
  local zip_path="$ROOT_DIR/local-playwright-gauntlet-${RUN_ID}.zip"
  rm -f "$zip_path"
  zip -qr "$zip_path" \
    logs/local-playwright-gauntlet \
    playwright-report \
    test-results \
    package.json \
    playwright.config.ts \
    tests/e2e \
    2>/dev/null || true
  echo "$zip_path"
}

echo ""
echo "============================================================"
echo " Agency Event OS — Local Headed Playwright Gauntlet"
echo "============================================================"
echo "Repo: $ROOT_DIR"
echo "Base URL: $PLAYWRIGHT_BASE_URL"
echo "NODE_OPTIONS: $NODE_OPTIONS"
echo "Headed: $PLAYWRIGHT_HEADED"
echo "Retries: $PLAYWRIGHT_RETRIES"
echo "Video disabled: $PLAYWRIGHT_DISABLE_VIDEO"
echo "Local Playwright auth bypass: $LOCAL_PLAYWRIGHT_GAUNTLET_AUTH"
echo "Runtime store: $AGENCY_EVENT_OS_RUNTIME_STORE"
echo "Allow file runtime in local prod server: $ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION"
echo "Local access env: seeded for E2E only"
echo "Log dir: $LOG_DIR"
echo ""

echo "Cleaning old local browser artifacts..."
rm -rf playwright-report test-results

run_and_log "00-node" node -v || true
run_and_log "01-npm" npm -v || true
run_and_log "02-npm-ci" npm ci || {
  echo "npm ci failed. Packaging diagnostics."
  ZIP_PATH="$(zip_reports)"
  echo "Diagnostic ZIP: $ZIP_PATH"
  exit 1
}

run_and_log "03-build-recoverable" npm run build:recoverable || {
  echo "build:recoverable failed. Packaging diagnostics."
  ZIP_PATH="$(zip_reports)"
  echo "Diagnostic ZIP: $ZIP_PATH"
  exit 1
}

if [[ "$PLAYWRIGHT_BASE_URL" == "http://127.0.0.1:3000" || "$PLAYWRIGHT_BASE_URL" == "http://localhost:3000" ]]; then
  echo "Starting local Next server..."
  npm run start > "$LOG_DIR/04-next-start.log" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$LOG_DIR/04-next-start.pid"

  echo "Waiting for local server..."
  SERVER_READY=0
  for i in {1..60}; do
    if curl -fsS "$PLAYWRIGHT_BASE_URL/" >/dev/null 2>&1; then
      SERVER_READY=1
      break
    fi
    sleep 2
  done

  if [[ "$SERVER_READY" != "1" ]]; then
    echo "Server did not become ready. Packaging diagnostics."
    tail -120 "$LOG_DIR/04-next-start.log" || true
    ZIP_PATH="$(zip_reports)"
    echo "Diagnostic ZIP: $ZIP_PATH"
    exit 1
  fi

  curl -I "$PLAYWRIGHT_BASE_URL/" 2>&1 | tee "$LOG_DIR/05-curl-home-headers.log" || true
else
  echo "Using deployed/base URL mode. No local server started."
  curl -I "$PLAYWRIGHT_BASE_URL/" 2>&1 | tee "$LOG_DIR/05-curl-base-url-headers.log" || true
fi

run_and_log "06-playwright-version" npx playwright --version || true
run_and_log "07-playwright-install-chromium" npx playwright install chromium || true

TEST_STATUS=0
PLAYWRIGHT_HEADED="$PLAYWRIGHT_HEADED" PLAYWRIGHT_RETRIES="$PLAYWRIGHT_RETRIES" PLAYWRIGHT_BASE_URL="$PLAYWRIGHT_BASE_URL" \
  npx playwright test --pass-with-no-tests 2>&1 | tee "$LOG_DIR/08-playwright-test.log" || TEST_STATUS=${PIPESTATUS[0]}
echo "$TEST_STATUS" > "$LOG_DIR/08-playwright-test.exit"

ZIP_PATH="$(zip_reports)"

echo ""
echo "============================================================"
echo " Done"
echo "============================================================"
echo "Playwright exit code: $TEST_STATUS"
echo "Diagnostic ZIP: $ZIP_PATH"
echo ""
echo "If tests failed, upload this ZIP back to ChatGPT:"
echo "$ZIP_PATH"
echo ""
echo "To open the HTML report manually:"
echo "npx playwright show-report"
echo ""

if [[ "$TEST_STATUS" != "0" ]]; then
  npx playwright show-report || true
  exit "$TEST_STATUS"
fi

exit 0
