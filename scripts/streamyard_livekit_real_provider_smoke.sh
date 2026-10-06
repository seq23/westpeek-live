#!/usr/bin/env bash
set -euo pipefail

if [[ "${STREAMYARD_REAL_PROVIDER_SMOKE:-}" != "1" ]]; then
  echo "streamyard_livekit_real_provider_smoke: BLOCKED"
  echo "Set STREAMYARD_REAL_PROVIDER_SMOKE=1 to acknowledge this requires a real StreamYard Custom RTMP or controlled RTMP broadcaster test."
  exit 2
fi

BASE_URL="${POSTDEPLOY_BASE_URL:-${PLAYWRIGHT_BASE_URL:-${SMOKE_BASE_URL:-${NEXT_PUBLIC_APP_URL:-}}}}"
if [[ -z "$BASE_URL" ]]; then
  echo "streamyard_livekit_real_provider_smoke: BLOCKED — set POSTDEPLOY_BASE_URL, PLAYWRIGHT_BASE_URL, SMOKE_BASE_URL, or NEXT_PUBLIC_APP_URL."
  exit 2
fi
if [[ ! "$BASE_URL" =~ ^https?:// ]] || [[ "$BASE_URL" =~ localhost|127\.0\.0\.1|0\.0\.0\.0 ]]; then
  echo "streamyard_livekit_real_provider_smoke: BLOCKED — Tier 4 real provider proof requires a non-local deployed base URL."
  exit 2
fi

missing=()
for key in LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET LIVEKIT_WEBHOOK_SECRET V5_ACCESS_COOKIE_SECRET; do
  if [[ -z "${!key:-}" ]]; then missing+=("$key"); fi
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "streamyard_livekit_real_provider_smoke: BLOCKED — missing required env: ${missing[*]}"
  exit 2
fi

if [[ "${STREAMYARD_OPERATOR_CONFIRMED_BROADCAST:-}" != "1" ]]; then
  cat <<'MANUAL'
streamyard_livekit_real_provider_smoke: BLOCKED — real operator confirmation required.

Manual real-provider step:
1. Open the deployed Operator Launchpad / Testing Console.
2. Generate StreamYard → LiveKit ingress credentials.
3. Open StreamYard.
4. Choose Custom RTMP.
5. Paste generated RTMP URL.
6. Paste generated Stream Key.
7. Start a private test broadcast.
8. Confirm StreamYard shows live/connected and the app reports LiveKit ingress started / LIVEKIT_INGRESS_LIVE.
9. Create the Tier 4 evidence JSON from TIER4_PROVIDER_EVIDENCE_TEMPLATE.json.
10. Re-run with STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 and TIER4_STREAMYARD_LIVE_EVIDENCE_PATH=<path>.
MANUAL
  exit 2
fi

if [[ -z "${TIER4_STREAMYARD_LIVE_EVIDENCE_PATH:-}" ]]; then
  echo "streamyard_livekit_real_provider_smoke: BLOCKED — set TIER4_STREAMYARD_LIVE_EVIDENCE_PATH to a redacted evidence JSON file."
  exit 2
fi
if [[ ! -f "$TIER4_STREAMYARD_LIVE_EVIDENCE_PATH" ]]; then
  echo "streamyard_livekit_real_provider_smoke: BLOCKED — evidence file not found: $TIER4_STREAMYARD_LIVE_EVIDENCE_PATH"
  exit 2
fi

if grep -Eiq 'LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET|CLOUDFLARE_API_TOKEN|RESEND_API_KEY|DAILY_API_KEY|ZOOM_MEETING_SDK_SECRET|V5_ACCESS_COOKIE_SECRET|rtmps?://|Bearer[[:space:]]+[A-Za-z0-9._~+/=-]{16,}' "$TIER4_STREAMYARD_LIVE_EVIDENCE_PATH"; then
  echo "streamyard_livekit_real_provider_smoke: FAIL — evidence file appears to contain unredacted secret/provider material. Redact before continuing."
  exit 1
fi

node -e '
const fs=require("fs");
const raw=fs.readFileSync(process.env.TIER4_STREAMYARD_LIVE_EVIDENCE_PATH,"utf8");
if (/"streamKey"\s*:\s*"(?!\[REDACTED_STREAM_KEY\])[^"]+"/i.test(raw)) {
  console.error("streamyard_livekit_real_provider_smoke: FAIL — evidence file contains an unredacted streamKey value.");
  process.exit(1);
}
'

node -e '
const fs=require("fs");
const file=process.env.TIER4_STREAMYARD_LIVE_EVIDENCE_PATH;
const data=JSON.parse(fs.readFileSync(file,"utf8"));
const required=["providerLane","deployedBaseUrl","eventId","stageId","operatorConfirmedBroadcast","streamyardBroadcastStartedAt","livekitIngressIdRedacted","appReportedStates","secretsExposed","cleanupStatus"];
const missing=required.filter((key)=>data[key]===undefined||data[key]===null||data[key]==="");
if(missing.length){ console.error(`Missing evidence fields: ${missing.join(", ")}`); process.exit(1); }
if(data.providerLane!=="streamyard-livekit"){ console.error("providerLane must be streamyard-livekit"); process.exit(1); }
if(data.operatorConfirmedBroadcast!==true){ console.error("operatorConfirmedBroadcast must be true"); process.exit(1); }
if(data.secretsExposed!==false){ console.error("secretsExposed must be false"); process.exit(1); }
if(process.env.POSTDEPLOY_BASE_URL && data.deployedBaseUrl!==process.env.POSTDEPLOY_BASE_URL){ console.error("evidence deployedBaseUrl does not match POSTDEPLOY_BASE_URL"); process.exit(1); }
console.log("StreamYard/LiveKit evidence JSON validated without raw secret material.");
'

echo "Base URL: $BASE_URL"
curl -fsS "$BASE_URL/" >/dev/null
npm run validate:day1-streamyard-model
npm run probe:streamyard-livekit:mock

POSTDEPLOY_BASE_URL="$BASE_URL" \
PLAYWRIGHT_BASE_URL="$BASE_URL" \
TIER4_EVENT_ID="${TIER4_EVENT_ID:-${STREAMYARD_E2E_EVENT_ID:-}}" \
STREAMYARD_E2E_EVENT_ID="${STREAMYARD_E2E_EVENT_ID:-${TIER4_EVENT_ID:-}}" \
PLAYWRIGHT_DEPLOYED=1 \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
STREAMYARD_REAL_PROVIDER_SMOKE=1 \
STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 \
npx playwright test tests/e2e/streamyard-producer-ingress.spec.ts

echo "PASS — real provider smoke completed with operator-confirmed StreamYard broadcast and redacted Tier 4 evidence."
