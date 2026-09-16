#!/usr/bin/env node
// Runtime-first events contract (ADM-2026-09-15-RUNTIME-EVENTS).
// Proves, statically, that the event source stays runtime-first with seed fallback, that the Supabase
// migration mirror cannot drift from the canonical SQL, and that the public health endpoint exists so
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

// 1. Canonical migration and its Supabase GitHub-integration mirror must be byte-identical.
const canonical = "db/migrations/0024_runtime_events.sql";
const mirrorDir = "supabase/migrations";
const canonicalSql = read(canonical);
const mirrors = fs.existsSync(mirrorDir) ? fs.readdirSync(mirrorDir).filter((name) => name.endsWith("_runtime_events.sql")) : [];
if (mirrors.length !== 1) failures.push(`${mirrorDir} must contain exactly one *_runtime_events.sql mirror (found ${mirrors.length})`);
for (const name of mirrors) {
  const mirrorSql = read(path.join(mirrorDir, name));
  if (mirrorSql !== canonicalSql) failures.push(`${mirrorDir}/${name} drifted from ${canonical}; copy the canonical file over it`);
}
for (const table of ["runtime_events", "runtime_clients", "runtime_agency_settings"]) {
  if (!canonicalSql.includes(`create table if not exists public.${table}`)) failures.push(`${canonical} must create ${table} idempotently`);
}
if (!fs.existsSync("supabase/config.toml") || !read("supabase/config.toml").includes("project_id")) failures.push("supabase/config.toml must anchor the GitHub integration with a project_id");

// 2. The repository is runtime-first with seed fallback, and the schema-missing path is typed.
requireTokens("services/events/eventRepository.ts", [
  "getRuntimeStore().getRuntimeEvent(key)",
  "return seedEventRecord(key)",
  "RuntimeSchemaMissingError",
  "export async function getRuntimeSchemaStatus",
  "mintJoinCode",
  "mintAccessCodes",
]);
requireTokens("services/runtime/supabaseRuntimeStore.ts", ["PGRST205", "42P01", "runtime_events", "runtime_clients", "runtime_agency_settings"]);
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
requireTokens("lib/auth/workspaceActor.ts", ['kind: "owner"', "Sequoia Taylor / owner", "getCurrentUser"]);
for (const gone of ["services/events/eventDraftStore.ts", "components/persistence/EventPersistencePanel.tsx"]) {
  examined += 1;
  if (fs.existsSync(gone)) failures.push(`${gone} must stay deleted; there is one create path`);
}
forbidTokens("components/events/EventPortfolio.tsx", ["EventPersistencePanel"]);

// 5. The public health endpoint reports schema readiness without secrets.
requireTokens("app/api/runtime/health/route.ts", ["getRuntimeSchemaStatus", "missingTables", "migrationFile", '"cache-control": "no-store"']);
forbidTokens("app/api/runtime/health/route.ts", ["SUPABASE_SERVICE_ROLE_KEY", "accessCodes", "joinCode"]);

// 6. Post-deploy proof reads the health endpoint.
requireTokens("scripts/post_deploy_smoke_test.js", ["/api/runtime/health"]);

if (examined === 0) failures.push("validate_runtime_events_contract examined zero files");
if (failures.length) {
  console.error("validate_runtime_events_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_runtime_events_contract: PASS — ${examined} files examined; static contract only, live schema state is read from /api/runtime/health after deploy.`);
