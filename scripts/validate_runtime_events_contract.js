#!/usr/bin/env node
// Runtime-first events contract (ADM-2026-09-15-RUNTIME-EVENTS).
// Proves, statically, that the event source stays runtime-first with seed fallback, that the D1
// schema creates the runtime tables once and is applied on deploy, and that the public health endpoint exists so
// a missing migration is a named stop rather than a silent failure. Hard-fails on zero examined items.
const fs = require("fs");
const path = require("path");

const failures = [];
let examined = 0;
function read(file) {
  if (!fs.existsSync(file)) { failures.push(`missing ${file}`); return ""; }
  examined += 1;
  return fs.readFileSync(file, "utf8");
}
function requireTokens(file, tokens) {
  const text = read(file);
  for (const token of tokens) if (!text.includes(token)) failures.push(`${file} missing required token: ${token}`);
}
function forbidTokens(file, tokens) {
  const text = read(file);
  for (const token of tokens) if (text.includes(token)) failures.push(`${file} still contains forbidden token: ${token}`);
}

// 1. The runtime tables live in migrations-d1 (applied by the deploy workflow before every deploy).
{
  const { d1Table } = require("./lib/d1Schema");
  for (const table of ["runtime_events", "runtime_clients", "runtime_agency_settings"]) {
    examined += 1;
    if (d1Table(table).file !== "migrations-d1/0003_runtime.sql") failures.push(`migrations-d1/0003_runtime.sql must create ${table} idempotently`);
  }
}
const deployWorkflow = read(".github/workflows/deploy-cloudflare-worker.yml");
if (!deployWorkflow.includes("npx wrangler d1 migrations apply west-peek-live --remote")) failures.push("the deploy workflow must apply the D1 migrations, or a new table never reaches production");

// 2. The repository is runtime-first with seed fallback, and the schema-missing path is typed.
requireTokens("services/events/eventRepository.ts", [
  "getRuntimeStore().getRuntimeEvent(key)",
  "return seedEventRecord(key)",
  "RuntimeSchemaMissingError",
  "export async function getRuntimeSchemaStatus",
  "mintJoinCode",
  "mintAccessCodes",
]);
requireTokens("services/runtime/d1RuntimeStore.ts", ["no such table|no such column", "D1_NO_TABLE", "RuntimeSchemaMissingError", "runtime_events", "runtime_clients", "runtime_agency_settings"]);
requireTokens("services/runtime/fileRuntimeStore.ts", ["upsertRuntimeEvent", "listRuntimeClients", "setAgencySettings"]);

// 3. Every public entry resolves runtime events before compiled seed JSON.
requireTokens("services/events/eventStateResolver.ts", ["await ensureRuntimeEvent("]);
requireTokens("services/access/eventAccessResolver.ts", ["await ensureRuntimeEvent(", "accessCodes.crew", "getGeneratedEventRoleCode"]);
requireTokens("app/join/page.tsx", ["await resolveEventJoinCode("]);
for (const page of ["app/venue/[eventId]/lobby/page.tsx", "app/events/[slug]/page.tsx", "app/app/events/[eventId]/page.tsx", "app/app/events/[eventId]/access/page.tsx", "app/app/events/[eventId]/publish/page.tsx", "app/venue/[eventId]/run-of-show/page.tsx", "app/crew/events/[eventId]/page.tsx"]) {
  requireTokens(page, ["ensureRuntimeEvent("]);
}

// 4. One create page, owner-cookie identity, no cookie draft, no duplicate create form.
requireTokens("app/app/events/new/page.tsx", ['name="when"', 'value="now"', 'value="later"', "createEventAction", "RuntimeSchemaStop"]);
requireTokens("lib/actions/eventWorkspaceActions.ts", ["requireWorkspaceActor", "createEventRecord", "archiveEventRecord", "restoreEventRecord", "setEventStatus"]);
requireTokens("lib/auth/workspaceActor.ts", ['kind: "owner"', 'OWNER_ACTOR_LABEL = "Owner"', "getCurrentUser"]);
for (const gone of ["services/events/eventDraftStore.ts", "components/persistence/EventPersistencePanel.tsx"]) {
  examined += 1;
  if (fs.existsSync(gone)) failures.push(`${gone} must stay deleted; there is one create path`);
}
forbidTokens("components/events/EventPortfolio.tsx", ["EventPersistencePanel"]);

// 5. The public health endpoint reports schema readiness without secrets.
requireTokens("app/api/runtime/health/route.ts", ["getRuntimeSchemaStatus", "missingTables", "migrationFile", '"cache-control": "no-store"']);
forbidTokens("app/api/runtime/health/route.ts", ["CLOUDFLARE_API_TOKEN", "V5_ACCESS_COOKIE_SECRET", "accessCodes", "joinCode"]);

// 6. Post-deploy proof reads the health endpoint.
requireTokens("scripts/post_deploy_smoke_test.js", ["/api/runtime/health"]);

// 7. No migration may create a table name another one already created. 0027 once said `create table
//    if not exists` for speed_networking_* while 0010 had created tables of those names with uuid ids:
//    the create was a silent no-op and every crew page 500'd during a live workshop (16 Sep 2026).
//    In migrations-d1 every table is created exactly once.
{
  const { d1Files } = require("./lib/d1Schema");
  const names = d1Files();
  const createdBy = new Map();
  for (const name of names) {
    const sql = read(path.join("migrations-d1", name)).replace(/--.*$/gm, "");
    for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+) \(/g)) {
      if (createdBy.has(m[1])) failures.push(`migrations-d1/${name} creates ${m[1]}, which ${createdBy.get(m[1])} already created: a "create table if not exists" is a silent no-op against a table of another shape`);
      else createdBy.set(m[1], name);
    }
  }
  if (names.length < 6) failures.push(`only ${names.length} migrations-d1 files examined; expected 0001-0006`);
  if (createdBy.size < 60) failures.push(`only ${createdBy.size} tables found in migrations-d1; expected at least 60`);
}

if (examined === 0) failures.push("validate_runtime_events_contract examined zero files");
if (failures.length) {
  console.error("validate_runtime_events_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_runtime_events_contract: PASS — ${examined} files examined; static contract only, live schema state is read from /api/runtime/health after deploy.`);
