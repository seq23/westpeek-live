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

// 7. No migration may re-create a table name an earlier migration already created, unless it first
//    moves that table aside (rename) or drops it. Migration 0027 said `create table if not exists`
//    for speed_networking_entries / speed_networking_matches while 0010 had already created tables of
//    those names with uuid ids: the create was a no-op, the store wrote slugs into uuid columns, and
//    every crew page 500'd during a live workshop (16 Sep 2026). Applies to db/migrations in order.
{
  const migrationDir = "db/migrations";
  const names = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort() : [];
  const createdBy = new Map(); // table -> migration that first created it
  for (const name of names) {
    const sql = read(path.join(migrationDir, name));
    // Comments are prose ("0027 used `create table if not exists`…"), not statements.
    const lower = sql.split("\n").map((line) => line.replace(/--.*$/, "")).join("\n").toLowerCase();
    // The rule is enforced from the runtime-first era (0024) on; 0001–0023 carry historic duplicate
    // creates of the same shape from the pre-runtime schema and are the baseline, not a target.
    const enforced = Number(name.slice(0, 4)) >= 24;
    const creates = [...lower.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/g)].map((m) => m[1]);
    for (const table of creates) {
      const first = createdBy.get(table);
      if (first && first !== name && enforced) {
        const movedAside = new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+rename\\s+to`).test(lower) || new RegExp(`drop\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${table}\\b`).test(lower);
        if (!movedAside) failures.push(`${migrationDir}/${name} creates ${table}, which ${first} already created: a "create table if not exists" is a silent no-op against a table of another shape — rename the old table aside (or drop it) in the same migration, or pick a new name`);
      } else if (!first) createdBy.set(table, name);
    }
  }
  if (names.length < 20) failures.push(`only ${names.length} migrations examined; expected the full history`);
}

// 8. Every migration from 0025 on must have a byte-identical mirror in supabase/migrations: the
//    Supabase GitHub integration applies THAT directory on merge to main, so a canonical file
//    without a mirror never reaches production. 0030 (contacts.archived_at) shipped without one on
//    16 Sep 2026 and "Archive test rows" silently no-opped against the live database.
{
  const canonicalDir = "db/migrations";
  const names = fs.existsSync(canonicalDir) ? fs.readdirSync(canonicalDir).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort() : [];
  const mirrorFiles = fs.existsSync(mirrorDir) ? fs.readdirSync(mirrorDir).filter((name) => name.endsWith(".sql")) : [];
  let mirrored = 0;
  for (const name of names) {
    if (Number(name.slice(0, 4)) < 25) continue;
    const suffix = name.replace(/^\d{4}_/, "");
    const mirror = mirrorFiles.find((file) => file.endsWith(`_${suffix}`));
    examined += 1;
    if (!mirror) {
      failures.push(`${canonicalDir}/${name} has no mirror in ${mirrorDir}/*_${suffix}; the Supabase integration applies the mirror directory, so this migration would never run in production`);
      continue;
    }
    mirrored += 1;
    if (read(path.join(mirrorDir, mirror)) !== read(path.join(canonicalDir, name))) failures.push(`${mirrorDir}/${mirror} drifted from ${canonicalDir}/${name}; copy the canonical file over it`);
  }
  if (!mirrored) failures.push("no migration mirrors examined; the parity rule would pass on an empty loop");
}

if (examined === 0) failures.push("validate_runtime_events_contract examined zero files");
if (failures.length) {
  console.error("validate_runtime_events_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_runtime_events_contract: PASS — ${examined} files examined; static contract only, live schema state is read from /api/runtime/health after deploy.`);
