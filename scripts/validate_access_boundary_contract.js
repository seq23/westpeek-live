const fs = require("fs");
function fail(message) { console.error("validate_access_boundary_contract: FAIL — " + message); process.exit(1); }
function read(file) { if (!fs.existsSync(file)) fail("missing " + file); return fs.readFileSync(file, "utf8"); }
const envTs = read("lib/env.ts");
const productionAccess = read("lib/auth/productionAccess.ts");
const routeAuth = read("lib/auth/v5RouteAuthorization.ts");
const crew = read("app/production-access/crew/page.tsx");
const operator = read("app/production-access/operator/page.tsx");
const owner = read("app/production-access/owner/page.tsx");
const launchpad = read("app/production-access/launchpad/page.tsx");
const middleware = read("middleware.ts");
if (!envTs.includes("OPERATOR_LAUNCHPAD_PASSWORD")) fail("env missing OPERATOR_LAUNCHPAD_PASSWORD");
if (!envTs.includes("OWNER_MASTER_ACCESS_PASSWORD")) fail("env missing OWNER_MASTER_ACCESS_PASSWORD");
if (!envTs.includes("V5_OWNER_COOKIE_NAME")) fail("env missing V5_OWNER_COOKIE_NAME");
if (!envTs.includes("assertSeparatedProductionPasswords")) fail("env must hard-fail matching crew/operator passwords");
if (!productionAccess.includes('kind: "operator"')) fail("V5 access cookie payload must include operator kind");
if (!productionAccess.includes('kind: "owner"')) fail("V5 access cookie payload must include owner kind");
// The crew gate checks the global crew password (and, for runtime-created events, that event's own crew code)
// through resolveCrewAccess, which is where getCrewAccessPassword is read.
const crewResolver = read("services/access/eventAccessResolver.ts");
const crewUsesPassword = crew.includes("getCrewAccessPassword") || (crew.includes("resolveCrewAccess") && crewResolver.includes("getCrewAccessPassword") && crewResolver.includes("accessCodes.crew"));
if (!crewUsesPassword || crew.includes('redirect("/production-access/launchpad")')) fail("crew gate must use crew password (global or per-event crew code) and must not redirect directly to launchpad");
if (!operator.includes("getOperatorLaunchpadPassword") || !operator.includes('kind: "operator"')) fail("operator gate must use operator password and set operator cookie");
if (!owner.includes("getOwnerMasterPassword") || !owner.includes('kind: "owner"')) fail("owner gate must use owner password and set owner cookie");
if (!launchpad.includes('operatorPayload?.kind === "operator"')) fail("launchpad must accept operator cookie");
if (!launchpad.includes('ownerPayload?.kind === "owner"')) fail("launchpad must accept owner master cookie as universal authority");
if (launchpad.includes('payload.kind === "crew"') || launchpad.includes('crewPayload?.kind === "crew"')) fail("launchpad must not accept crew cookie");
if (!routeAuth.includes("canOperatorAccessPath")) fail("route authorization must include operator access path helper");
if (!routeAuth.includes("canOwnerAccessPath")) fail("route authorization must include owner access path helper");
if (!middleware.includes("readOperatorAccess") || !middleware.includes("canOperatorAccessPath")) fail("middleware must check operator access separately");
if (!middleware.includes("readOwnerAccess") || !middleware.includes("canOwnerAccessPath")) fail("middleware must check owner access separately");

if (operator.includes('accessKind: "crew"')) fail("operator gate must not log operator attempts as crew access");
if (!operator.includes('accessKind: "operator"')) fail("operator gate must log operator accessKind");
if (crew.includes('"executive_producer"') || crew.includes('"producer"')) fail("crew gate must not offer producer/executive_producer roles; those belong to operator/admin access");
if (crew.includes('Enter production launchpad') || crew.includes('redirect("/production-access/launchpad")')) fail("crew gate must not promise or redirect to operator launchpad");
if (routeAuth.includes('pathname.startsWith("/app/events/") && !pathname.includes("/new")')) fail("operator access must use an explicit event-surface allowlist, not broad /app/events access");
// Operator access is intentionally event-scoped: the Day 1 operator may use explicit event production
// surfaces such as setup, crew briefing, run-of-show, preview, and video health after the operator gate.
// What remains forbidden is broad, pattern-based /app/events access or account/platform-owner surfaces.
for (const required of ['"setup"', '"crew"', '"run-of-show"', '"preview"']) {
  if (!routeAuth.includes(required) || !routeAuth.includes('operatorEventSurfaceSuffixes')) {
    fail(`operator event-scoped allowlist missing approved production surface ${required}`);
  }
}
for (const forbidden of ['"settings"', '"billing"', '"users"', '"secrets"', '"account"']) {
  if (routeAuth.includes(forbidden) && routeAuth.includes('operatorEventSurfaceSuffixes')) {
    fail(`operator event-surface allowlist must not include platform-owner surface ${forbidden}`);
  }
}
const runtimeStore = read("services/runtime/runtimeStore.ts");
const v4Types = read("types/v4.ts");
if (!runtimeStore.includes('"operator"')) fail("runtime access attempt type must include operator");
if (!v4Types.includes('"operator"')) fail("V4AccessKind must include operator");
console.log("validate_access_boundary_contract: PASS");
