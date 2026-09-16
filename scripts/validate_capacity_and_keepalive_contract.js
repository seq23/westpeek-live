const fs = require("fs");
/**
 * PLANS, CAPACITY AND THE KEEP-ALIVE — guarded, not described.
 *
 * Three defects this exists to catch:
 *  1. A plan number retyped into prose somewhere and drifting from the dashboard. Every allowance
 *     lives in lib/capacity/capacityPlans.ts and nowhere else.
 *  2. A readout that shows 0 where it means "we could not read it". On the 28th of a busy month
 *     that zero reads as "600 minutes left" and is the most expensive lie the page could tell.
 *  3. A keep-alive that exists but nothing runs — Supabase pauses anyway and the app is dead on
 *     the next open. The schedule, the route and the store assertion are all checked here.
 */
let examined = 0;
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); examined += 1; return fs.readFileSync(file, "utf8"); }
function check(file, tokens) {
  const body = read(file);
  const missing = tokens.filter((token) => !body.includes(token));
  if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`);
  return body;
}

// 1. The allowances, in one place, with the Ship numbers the dashboard showed on 16 Sep 2026.
const plans = check("lib/capacity/capacityPlans.ts", [
  "export type LiveKitTier", "export function livekitTier", "export function livekitPlan", "export function fractionUsed",
  "CLOUDFLARE_WORKERS_PLAN", "CLOUDFLARE_STREAM_PLAN", "SUPABASE_PLAN", "LIVEKIT_TIER",
]);
for (const number of ["600", "150_000", "250", "1_000", "0.02", "0.0005", "0.12", "10_000_000", "128", "500", "autoPauseIdleDays: 7"]) {
  if (!plans.includes(number)) throw new Error(`lib/capacity/capacityPlans.ts has lost the plan figure ${number}`);
}
if (!/included: null/.test(plans)) throw new Error("An allowance nobody read from the dashboard must be null, never 0.");
if (/included: 0\b/.test(plans)) throw new Error("An unconfirmed allowance is written as 0 — that draws a comfortable bar against a number nobody checked.");
if (!/return used \/ included/.test(plans)) throw new Error("fractionUsed must divide real numbers only.");

// 2. Reading: real where the API answers, unknown-with-a-reason where it does not.
// The twirp base URL must be the normalized https:// form, never the raw wss:// value LIVEKIT_URL
// holds — validate_livekit_twirp_url_contract.js owns that rule; this only checks the calls exist.
const service = check("services/capacity/capacityReadingService.ts", [
  "/twirp/livekit.", "normalizeLiveKitApiBaseUrl", "RoomService/ListRooms", "Ingress/ListIngress", "roomList: true",
  "export async function readCapacityPosition", "export async function readLiveKitLiveSnapshot",
  "unknownReason", "pingRuntimeStore",
]);
if (!/value: null/.test(service)) throw new Error("A reading that could not be taken must carry value: null.");
if (/value: 0,\s*unit/.test(service)) throw new Error("A reading defaults to 0 somewhere — an unread number must be null.");

const readout = check("components/capacity/CapacityReadout.tsx", [
  'if (reading.value === null) return "unknown"',
  "No bar: the number is unknown",
  "reading.unknownReason",
  "data-testid={`capacity-reading-",
  "First cliff",
]);
// Transcode minutes is the first and most prominent thing on the page.
const firstCliff = readout.indexOf("Transcode minutes");
const restOfMonth = readout.indexOf("The rest of the LiveKit month");
if (firstCliff < 0 || restOfMonth < 0 || firstCliff > restOfMonth) throw new Error("Transcode minutes must be the first and most prominent block on the readout.");
if (!readout.includes("prominent")) throw new Error("The transcode row must render with the prominent bar.");

// The page exists, is behind the operator/owner gate, and the launchpad actually links to it.
check("app/app/capacity/page.tsx", ["CapacityReadout", "readV5AccessCookie", 'operator?.kind === "operator"', 'owner?.kind === "owner"']);
check("lib/auth/v5RouteAuthorization.ts", ['"/app/capacity"']);
check("components/production/OperatorLaunchpad.tsx", ['href="/app/capacity"']);

// 3. The keep-alive: a trivial read, no writes, no noise, and something that runs it.
const keepAlive = check("services/runtime/supabaseKeepAlive.ts", ["export async function pingRuntimeStore", "getContact(KEEP_ALIVE_PROBE_KEY)", "KEEP_ALIVE_PROBE_KEY"]);
if (/console\.(log|warn|error|info)/.test(keepAlive)) throw new Error("The keep-alive must log nothing: daily noise in the tail hides a real show-day error.");
for (const write of ["upsert", "setStageStreamState", "append"]) {
  if (keepAlive.includes(`store.${write}`) || keepAlive.includes(`.${write}(`)) throw new Error(`The keep-alive must only read; it calls ${write}.`);
}
const route = check("app/api/runtime/keep-alive/route.ts", ["pingRuntimeStore", "store: ping.store", '"cache-control": "no-store"']);
if (/console\.(log|warn|error|info)/.test(route)) throw new Error("The keep-alive route must log nothing.");
const workflow = check(".github/workflows/supabase-keep-alive.yml", ["/api/runtime/keep-alive", "workflow_dispatch", '"store":"supabase"', "timeout-minutes:"]);
if (!/^\s+- cron: /m.test(workflow)) throw new Error("The keep-alive workflow has no schedule — it would only ever run when somebody remembered to press the button.");
if (/continue-on-error:\s*true/.test(workflow)) throw new Error("The keep-alive must not hide a paused project behind continue-on-error.");

// LIVEKIT_TIER is classified where every other env name is, so the registry validator can see it.
const registry = JSON.parse(read("deployment/env-var-registry.json"));
const classified = [...(registry.requiredProductionEnv || []), ...(registry.cloudflareSecretKeys || []), ...(registry.localOnlyEnv || []), ...(registry.internalRuntimeEnv || []), ...(registry.optionalDevEnv || [])];
if (!classified.includes("LIVEKIT_TIER")) throw new Error("LIVEKIT_TIER is not classified in deployment/env-var-registry.json");
if ((registry.requiredProductionEnv || []).includes("LIVEKIT_TIER")) throw new Error("LIVEKIT_TIER has a default; making it required would spend a Worker variable slot for nothing.");

// The doc carries the table and says what to upgrade first.
check("docs/CAPACITY.md", ["600", "150,000", "250 GB", "1,000", "Transcode minutes", "What to upgrade first", "westpeek-fallback", "auto-pause"]);
check("docs/manual-notes/capacity.md", ["/app/capacity", "keep-alive"]);

// The behaviour is proven by tests, not by this file's reading of the source.
check("tests/unit/capacityAndKeepAlive.test.ts", ["a tier nobody read off the dashboard reports unknown, never zero", "is idempotent: it only reads", "is registered on a schedule"]);

if (examined < 12) throw new Error(`validate_capacity_and_keepalive_contract examined only ${examined} files — it cannot have checked the contract.`);
console.log(`validate_capacity_and_keepalive_contract: PASS — ${examined} files examined; allowances, unknown-not-zero and the keep-alive schedule proven by tests/unit/capacityAndKeepAlive.test.ts.`);
