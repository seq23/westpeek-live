#!/usr/bin/env node
/**
 * RUNTIME_TABLE_MIGRATIONS may not be forgotten (ADM-2026-09-16-MIGRATION-MAP-COVERAGE).
 *
 * The map in types/runtimeEvent.ts is what /api/runtime/health probes. It was hand-maintained, so an
 * author who added a migration and did not add an entry got no warning and the new object went
 * unprobed forever. That is how three migrations reached 17 Sep 2026 unapplied in production and were
 * each found by accident: 0030 (contacts.archived_at — "Archive test rows" silently did nothing),
 * 0037 (attendee_sessions.client_* — found only when the owner hit a named stop on /app/events/new),
 * and 0023 (request_event_intake — the base table of the whole Plan-an-event feature, absent, which
 * also blocked 0036 from applying).
 *
 * This validator reads the SQL, not a list: every table created and every column added by a migration
 * at or above MAP_FLOOR must appear in RUNTIME_TABLE_MIGRATIONS as `table` or `table.column`, pointing
 * at the migration that introduced it. Adding a migration without an entry now fails here, by name,
 * before the PR is green.
 *
 * Hard-fails when it examines zero migrations, so it can never pass on an empty loop.
 */
const fs = require("fs");
const path = require("path");

/**
 * 0023 (request_event_intake) is the floor because it is the earliest migration a real 2026 incident
 * reached for and did not find. 0001-0022 predate the runtime-first era, were applied by hand against
 * the live project before the Supabase GitHub integration existed, and are the baseline, not a target.
 */
const MAP_FLOOR = 23;
const migrationDir = "db/migrations";
const mapFile = "types/runtimeEvent.ts";

/**
 * Objects a migration creates that are deliberately NOT probed. Each needs a reason a reader can
 * check. Indexes, renames, drops and `alter column` are never parsed as objects in the first place,
 * so they never need to be listed here; this list is for a genuine created table or added column that
 * the health probe should not assert on. Keep it short — an exemption is a hole in the guard.
 *
 * A stale exemption is itself a failure: every entry must still be produced by the SQL below, or the
 * list is describing a world that no longer exists.
 */
const EXEMPT = [
  // Empty on purpose as of 17 Sep 2026: every table and column migrations 0023-0038 introduce is
  // worth naming, and three of them reached production unapplied. Shape of an entry, if one is ever
  // genuinely needed: { key: "table" | "table.column", reason: "why the probe should not assert it" }.
];

const failures = [];

// --- Read the map ----------------------------------------------------------
// The object's values are const identifiers (SPEED_NETWORKING_MIGRATION_FILE), so resolve those first.
function readMap(file) {
  if (!fs.existsSync(file)) {
    failures.push(`missing ${file}; there is no map to check`);
    return new Map();
  }
  const text = fs.readFileSync(file, "utf8");
  const consts = new Map();
  for (const match of text.matchAll(/export\s+const\s+([A-Z0-9_]+)\s*=\s*"([^"]+)"/g)) consts.set(match[1], match[2]);
  const start = text.indexOf("export const RUNTIME_TABLE_MIGRATIONS");
  if (start < 0) {
    failures.push(`${file} does not export RUNTIME_TABLE_MIGRATIONS`);
    return new Map();
  }
  const open = text.indexOf("{", start);
  const close = text.indexOf("\n};", open);
  if (open < 0 || close < 0) {
    failures.push(`${file}: could not read the RUNTIME_TABLE_MIGRATIONS object literal`);
    return new Map();
  }
  const body = text.slice(open + 1, close);
  const entries = new Map();
  for (const line of body.split("\n")) {
    const bare = line.replace(/\/\/.*$/, "").trim();
    if (!bare) continue;
    const match = bare.match(/^"?([A-Za-z0-9_.]+)"?\s*:\s*("([^"]+)"|[A-Z0-9_]+)\s*,?$/);
    if (!match) continue;
    const value = match[3] || consts.get(match[2]);
    if (!value) {
      failures.push(`${file}: entry ${match[1]} points at ${match[2]}, which is not a "db/migrations/..." string constant in this file`);
      continue;
    }
    entries.set(match[1], value);
  }
  return entries;
}

// --- Read the SQL ----------------------------------------------------------
/** Comments are prose that quotes DDL ("0027 used `create table if not exists`..."); strip them first. */
function statementsOf(sql) {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .toLowerCase()
    .split(";");
}

const names = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort()
  : [];
if (!names.length) failures.push(`${migrationDir} has no numbered migrations; nothing to check`);

/** key -> { migration, kind } for every object a migration at or above the floor introduces. */
const required = new Map();
let examined = 0;

for (const name of names) {
  if (Number(name.slice(0, 4)) < MAP_FLOOR) continue;
  examined += 1;
  const relative = `${migrationDir}/${name}`;
  const statements = statementsOf(fs.readFileSync(path.join(migrationDir, name), "utf8"));
  const createdHere = new Set();

  for (const statement of statements) {
    for (const match of statement.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/g)) {
      createdHere.add(match[1]);
      if (!required.has(match[1])) required.set(match[1], { migration: relative, kind: "table" });
    }
  }
  for (const statement of statements) {
    // One statement may carry several `add column` clauses; match them all against its one table.
    const target = statement.match(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/);
    if (!target) continue;
    // A column declared on a table this same migration creates is already covered by the table entry.
    if (createdHere.has(target[1])) continue;
    for (const match of statement.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/g)) {
      const key = `${target[1]}.${match[1]}`;
      if (!required.has(key)) required.set(key, { migration: relative, kind: "column" });
    }
  }
}

// --- Compare ---------------------------------------------------------------
const map = readMap(mapFile);
const exempt = new Map(EXEMPT.map((row) => [row.key, row.reason]));

for (const [key, reason] of exempt) {
  if (!required.has(key)) failures.push(`exemption for ${key} is stale — no migration at or above ${String(MAP_FLOOR).padStart(4, "0")} creates or adds it any more. Reason on file: ${reason}`);
  if (map.has(key)) failures.push(`${key} is both exempt and mapped; delete the exemption or delete the map entry`);
}

let checked = 0;
for (const [key, info] of required) {
  if (exempt.has(key)) continue;
  checked += 1;
  const mapped = map.get(key);
  if (!mapped) {
    failures.push(`${info.migration} introduces ${info.kind} ${key}, which has no RUNTIME_TABLE_MIGRATIONS entry — /api/runtime/health would never probe it, so an unapplied mirror stays invisible until a client hits it. Add "${key}": "${info.migration}" to ${mapFile}, or add a commented exemption saying why it is not worth probing.`);
    continue;
  }
  if (mapped !== info.migration) failures.push(`RUNTIME_TABLE_MIGRATIONS["${key}"] points at ${mapped}, but ${key} is introduced by ${info.migration}; the health probe would name the wrong file to run`);
}

// A key nothing supplies is a probe that can only ever report a table production does not need.
for (const key of map.keys()) {
  if (required.has(key)) continue;
  failures.push(`RUNTIME_TABLE_MIGRATIONS["${key}"] is not created or added by any migration at or above ${String(MAP_FLOOR).padStart(4, "0")}; remove it or point it at the migration that supplies it`);
}

if (!examined) failures.push(`validate_migration_map_coverage examined zero migrations at or above ${String(MAP_FLOOR).padStart(4, "0")}; the rule would pass on an empty loop`);
if (!checked) failures.push("validate_migration_map_coverage checked zero objects; the rule would pass on an empty loop");

if (failures.length) {
  console.error("validate_migration_map_coverage: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_migration_map_coverage: PASS — ${examined} migrations from ${String(MAP_FLOOR).padStart(4, "0")} on; ${checked} tables and columns, each mapped to the migration that introduces it (${exempt.size} exempt).`);
