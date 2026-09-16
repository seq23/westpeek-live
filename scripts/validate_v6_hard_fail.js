const fs = require("fs");
const { execFileSync } = require("child_process");
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""; }
function fail(message) { console.error(message); process.exit(1); }
execFileSync("node", ["scripts/validate_v6_completion_contract.js"], { stdio: "inherit" });
execFileSync("node", ["scripts/validate_v5_no_secrets.js"], { stdio: "inherit" });
execFileSync("node", ["scripts/validate_v5_event_config_schema.js"], { stdio: "inherit" });
execFileSync("node", ["scripts/validate_v5_publishing.js"], { stdio: "inherit" });
execFileSync("node", ["scripts/validate_v5_runtime_boundaries.js"], { stdio: "inherit" });
const migrationNames = fs.readdirSync("db/migrations").filter((name) => /^\d{4}_.*\.sql$/.test(name));
const nums = new Set();
for (const migration of migrationNames) {
  const num = migration.slice(0, 4);
  if (nums.has(num)) fail(`Duplicate migration number ${num}`);
  nums.add(num);
}
const routeAuth = read("lib/auth/v5RouteAuthorization.ts");
if (routeAuth.includes("pathname.includes(`/${eventId}`)")) fail("Route authorization must not use substring event matching.");
if (!routeAuth.includes("eventIdFromPath") || !routeAuth.includes("canPerformCrewAction")) fail("Route/action authorization helpers missing.");
const videoPolicy = read("services/video/roomFallbackService.ts") + read("services/video/videoFallbackPolicy.ts");
if (!videoPolicy.includes("zoom") || !videoPolicy.includes("confirmedByCrew")) fail("Zoom crew confirmation is missing.");
if (videoPolicy.includes("provider === \"zoom\" && canAutoSwitch")) fail("Zoom must not auto-switch.");

const prodRuntimeImportOffenders = [];
for (const top of ["app", "components", "lib", "services"]) {
  if (!fs.existsSync(top)) continue;
  for (const file of fs.readdirSync(top, { recursive: true }).filter((name) => /\.(ts|tsx)$/.test(name))) {
    const full = `${top}/${file}`;
    if (full === "services/runtime/v5RuntimeStateStore.ts") continue;
    const body = read(full);
    if (body.includes("@/services/runtime/v5RuntimeStateStore")) prodRuntimeImportOffenders.push(full);
  }
}
if (prodRuntimeImportOffenders.length) fail(`Production code must use getRuntimeStore(), not v5RuntimeStateStore: ${prodRuntimeImportOffenders.join(", ")}`);
const crewPage = read("app/production-access/crew/page.tsx");
if (!crewPage.includes('name="crewRole"') || !crewPage.includes('technical_director')) fail("Crew access must allow explicit crew role selection so capability-gated actions are reachable.");
const accessResolver = read("services/access/eventAccessResolver.ts");
if (!accessResolver.includes("crewRole") || !accessResolver.includes("role: crewRole")) fail("Crew resolver must preserve selected crew role in the access payload.");
// The mock-provider guard lives where the provider is chosen (it moved out of lib/env.ts when the
// registry was introduced; this validator went on asserting the old home and had been failing —
// and therefore unwired — ever since. Assert the guard where it actually is, and keep lib/env.ts
// defaulting production to a real provider.
const registry = read("services/video/videoProviderRegistry.ts");
if (!registry.includes("ALLOW_MOCK_VIDEO_PROVIDER_IN_PRODUCTION") || !registry.includes("VIDEO_PROVIDER=mock is not allowed in production")) fail("Production must refuse VIDEO_PROVIDER=mock unless ALLOW_MOCK_VIDEO_PROVIDER_IN_PRODUCTION=true (guard belongs in services/video/videoProviderRegistry.ts).");
const env = read("lib/env.ts");
if (!env.includes('isProduction ? "livekit" : "mock"')) fail("lib/env.ts must default production to a real video provider.");

const smoke = read("scripts/post_deploy_smoke_test.js");
if (smoke.includes("visible404") || smoke.includes("status < 500")) fail("Smoke test must not accept broad non-500 statuses.");
// Anti-theater: no unfinished copy shipped to a user. The old rule matched the bare word
// "placeholder" anywhere in a component, which flagged seventeen honest `placeholder=` input hints,
// Tailwind `placeholder:` classes, LiveKit's `withPlaceholder` prop and a comment saying NO
// PLACEHOLDERS — that noise is why this validator sat unwired and failing. What is forbidden is
// unfinished COPY: a TODO, or filler text a viewer can read.
{
  const forbiddenCopy = ["todo", "coming soon", "lorem ipsum", "placeholder text", "placeholder copy", "tbd —", "to be decided"];
  const offenders = [];
  for (const file of fs.readdirSync("components", { recursive: true }).filter((name) => /\.(tsx|ts)$/.test(name))) {
    const body = read(`components/${file}`)
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .toLowerCase();
    const hit = forbiddenCopy.find((word) => body.includes(word));
    if (hit) offenders.push(`components/${file} (${hit})`);
  }
  if (offenders.length) fail(`Anti-theater: unfinished copy in ${offenders.join(", ")}`);
}
console.log("validate_v6_hard_fail: PASS");
