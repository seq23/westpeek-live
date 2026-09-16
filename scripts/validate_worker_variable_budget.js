const fs = require("fs");
/**
 * Workers Free caps ONE Worker at 64 variables and secrets. On 16 Sep 2026 we were at 64 and a new
 * secret could not be added until 20 unread EVENT_*_CODE secrets were deleted. The required-secrets
 * manifest is what `wrangler secret put` is driven from, so it is the thing to keep under the cap:
 * 60 or fewer, leaving four slots of headroom for a show-day secret.
 */
const CAP = 64;
const BUDGET = 60;
function fail(message) { console.error(`validate_worker_variable_budget: FAIL — ${message}`); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync("deployment/cloudflare-required-secrets.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("deployment/env-var-registry.json", "utf8"));
const contract = JSON.parse(fs.readFileSync("_env_contract.json", "utf8"));
const lists = [
  ["deployment/cloudflare-required-secrets.json requiredSecrets", manifest.requiredSecrets],
  ["deployment/env-var-registry.json requiredProductionEnv", registry.requiredProductionEnv],
  ["deployment/env-var-registry.json cloudflareSecretKeys", registry.cloudflareSecretKeys],
  ["_env_contract.json requiredRuntimeEnv", contract.requiredRuntimeEnv],
  ["_env_contract.json cloudflareSecretEnv", contract.cloudflareSecretEnv],
];
for (const [label, list] of lists) {
  if (!Array.isArray(list) || !list.length) fail(`${label} is empty — nothing was examined`);
  if (list.length > BUDGET) fail(`${label} carries ${list.length} names; Workers Free caps a Worker at ${CAP} variables and secrets, so the manifests stay at ${BUDGET} or fewer. Delete what nothing reads before adding more.`);
  const duplicates = list.filter((name, index) => list.indexOf(name) !== index);
  if (duplicates.length) fail(`${label} repeats ${duplicates.join(", ")}`);
}
// The 20 deleted event-code secrets must not come back: no runtime code reads them.
const deleted = [];
for (const event of ["LEADERSHIP_RESET_WEBINAR", "PREMIUM_WORKSHOP_INTENSIVE", "PROVIDER_INNOVATION_EXPO", "SEED_DEMO_DAY"]) {
  for (const role of ["CLIENT", "CREW_LITE", "SPEAKER", "SPONSOR", "VIP"]) deleted.push(`EVENT_${event}_${role}_CODE`);
}
for (const [label, list] of lists) {
  const back = list.filter((name) => deleted.includes(name));
  if (back.length) fail(`${label} lists ${back.length} secret(s) deleted from the Worker on 16 Sep 2026 (${back[0]} …). Nothing reads them; the cap is real.`);
}
// The Cloudflare Stream fallback pair that IS configured must be declared everywhere.
for (const key of ["CLOUDFLARE_STREAM_FALLBACK_ENABLED", "CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL", "CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY", "CLOUDFLARE_STREAM_LIVE_INPUT_ID"]) {
  for (const [label, list] of lists) if (!list.includes(key)) fail(`${label} is missing ${key} (Fallback 1 is configured in production).`);
}
console.log(`validate_worker_variable_budget: PASS — ${lists.length} manifests examined, largest carries ${Math.max(...lists.map(([, list]) => list.length))} names (budget ${BUDGET}, Workers Free cap ${CAP}).`);
