#!/usr/bin/env bash
set -Eeuo pipefail
mkdir -p logs artifacts/diagnostics
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
run(){ echo "==> $*"; "$@" 2>&1 | tee -a logs/release-validate-container.log; }
has(){ npm run 2>/dev/null | grep -qE "^[[:space:]]+$1$"; }
run npm run validate:deployed-route-manifest
if has validate:no-secrets; then run npm run validate:no-secrets; elif has validate:secrets; then run npm run validate:secrets; elif has validate:v5-no-secrets; then run npm run validate:v5-no-secrets; fi
run npm run release:validate:local
echo 'CONTAINER VALIDATION: PASS'
