const fs = require("fs");
/**
 * Fallback 1 (Cloudflare Stream) is configured in production since 16 Sep 2026. The crew deck's
 * Go-live section must carry a self-contained card for the producer — who is not us — with the
 * RTMPS URL, the masked-until-Reveal stream key, click-to-copy on both, the five numbered steps,
 * and a way to test the attendee player. Readiness for every rung is read from the environment,
 * and a "Move down" to a rung with nothing behind it is refused in the UI AND at the server.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
check("lib/video/fallbackReadiness.ts", ["export function cloudflareFallbackReady", "export function ladderReadiness", "export function rungReadiness", "export function cloudflareFallbackCredentials", "CLOUDFLARE_FALLBACK_STEPS", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY", "CLOUDFLARE_STREAM_LIVE_INPUT_ID"]);
const card = check("components/testing/CloudflareFallbackCard.tsx", ["Fallback 1: Cloudflare Stream", "cloudflare-rtmps-url", "cloudflare-rtmps-key", "cloudflare-rtmps-key-reveal", "cloudflare-test-fallback-player", "cloudflare-fallback-steps", "CopyToClipboardButton", "data-revealed"]);
if (!/revealed \? streamKey : masked/.test(card)) throw new Error("The stream key must be masked until Reveal is clicked.");
if (/console\.(log|error|warn)/.test(card)) throw new Error("The stream key is a secret: the card must never log.");
const panel = check("components/testing/StreamYardIngressPanel.tsx", ["CloudflareFallbackCard", "cloudflareFallbackCredentials()", "ladderReadiness()", 'rungReadiness("CLOUDFLARE_STREAM")', "unready={unreadyReason(", "ladder-rung-", "data-ready=", "stage-signal-${signal}-refused"]);
for (const source of ["CLOUDFLARE_STREAM", "DAILY", "ZOOM", "GOOGLE_MEET"]) if (!panel.includes(`unreadyReason("${source}")`)) throw new Error(`Move down to ${source} is not refused when the rung is unconfigured.`);
check("lib/actions/stageStreamActions.ts", ["rungReadiness(target)", "throw new Error(`Refused: ${rung.reason}`)", "manual_switch_to_cloudflare_stream:"]);
// The five secrets are declared everywhere a deploy reads.
const manifests = [["deployment/cloudflare-required-secrets.json", "requiredSecrets"], ["deployment/env-var-registry.json", "requiredProductionEnv"], ["deployment/env-var-registry.json", "cloudflareSecretKeys"], ["_env_contract.json", "requiredRuntimeEnv"], ["_env_contract.json", "cloudflareSecretEnv"]];
for (const [file, key] of manifests) {
  const list = JSON.parse(read(file))[key];
  examined += 1;
  for (const secret of ["CLOUDFLARE_STREAM_FALLBACK_ENABLED", "CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY", "CLOUDFLARE_STREAM_LIVE_INPUT_ID"]) {
    if (!list.includes(secret)) throw new Error(`${file} ${key} missing ${secret}`);
  }
}
for (const example of [".env.example", ".env.local.example", ".env.preview.example", ".env.production.example"]) check(example, ["CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL=", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY=", "CLOUDFLARE_STREAM_LIVE_INPUT_ID="]);
check("ENVIRONMENT_VARIABLES.md", ["CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY", "Workers Free variable cap"]);
check("tests/unit/fallbackReadiness.test.ts", ["ready only with BOTH a playback URL and a stream key", "a reason a producer can act on"]);
if (examined < 14) throw new Error(`validate_cloudflare_stream_fallback_contract examined only ${examined} files`);
console.log(`validate_cloudflare_stream_fallback_contract: PASS — ${examined} files examined; readiness and refusal proven by tests/unit/fallbackReadiness.test.ts.`);
