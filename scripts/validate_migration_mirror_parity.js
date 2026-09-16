const fs = require("fs");
const path = require("path");
/**
 * A migration only reaches production through supabase/migrations: the Supabase GitHub integration
 * applies THAT directory on merge to main. db/migrations stays the readable history. Every mirror
 * check in this repo used to name one migration by hand (0024 here, 0029 there), so a brand-new
 * migration with no mirror passed everything — which is exactly how 0030 (contacts.archived_at)
 * shipped unapplied on 16 Sep 2026 and "Archive test rows" silently did nothing.
 *
 * This is the generic rule: from MIRROR_FLOOR on, every canonical migration must have exactly one
 * byte-identical mirror. 0001–0022 predate the convention (they were applied by hand before the
 * integration existed) and are the baseline, not a target.
 *
 * The floor moved from 0024 to 0023 on 17 Sep 2026. 0023 creates request_event_intake, the base table
 * of the whole Plan-an-event path, and had no mirror — so it never ran, so 0036's `alter table
 * public.request_event_intake` could not apply either, and the Supabase integration went red on main
 * with `relation "public.request_event_intake" does not exist` on two separate merges before anyone
 * noticed. The mirror is idempotent (`create table if not exists`) and sorts ahead of 0024's.
 */
const MIRROR_FLOOR = 23;
const canonicalDir = "db/migrations";
const mirrorDir = "supabase/migrations";
const failures = [];

if (!fs.existsSync(canonicalDir)) failures.push(`${canonicalDir} is missing`);
if (!fs.existsSync(mirrorDir)) failures.push(`${mirrorDir} is missing — the Supabase integration has nothing to apply`);

const canonical = fs.existsSync(canonicalDir) ? fs.readdirSync(canonicalDir).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort() : [];
const mirrors = fs.existsSync(mirrorDir) ? fs.readdirSync(mirrorDir).filter((name) => name.endsWith(".sql")) : [];
let examined = 0;

for (const name of canonical) {
  if (Number(name.slice(0, 4)) < MIRROR_FLOOR) continue;
  examined += 1;
  const suffix = name.replace(/^\d{4}_/, "");
  const matches = mirrors.filter((file) => file.endsWith(`_${suffix}`));
  if (matches.length === 0) {
    failures.push(`${canonicalDir}/${name} has no mirror in ${mirrorDir}; it would never run in production. Copy it to ${mirrorDir}/<timestamp>_${suffix}`);
    continue;
  }
  if (matches.length > 1) {
    failures.push(`${canonicalDir}/${name} has ${matches.length} mirrors (${matches.join(", ")}); exactly one, or the integration applies it twice`);
    continue;
  }
  const canonicalSql = fs.readFileSync(path.join(canonicalDir, name), "utf8");
  const mirrorSql = fs.readFileSync(path.join(mirrorDir, matches[0]), "utf8");
  if (canonicalSql !== mirrorSql) failures.push(`${mirrorDir}/${matches[0]} drifted from ${canonicalDir}/${name}; copy the canonical file over it`);
}

// Mirrors are applied in filename order: a mirror must not sort before the mirror of an earlier migration.
const ordered = canonical.filter((name) => Number(name.slice(0, 4)) >= MIRROR_FLOOR).map((name) => ({ name, mirror: mirrors.find((file) => file.endsWith(`_${name.replace(/^\d{4}_/, "")}`)) })).filter((row) => row.mirror);
for (let index = 1; index < ordered.length; index += 1) {
  if (ordered[index].mirror <= ordered[index - 1].mirror) failures.push(`${mirrorDir}/${ordered[index].mirror} sorts before ${ordered[index - 1].mirror}, so ${ordered[index].name} would be applied out of order`);
}

if (!examined) failures.push(`validate_migration_mirror_parity examined zero migrations at or above ${MIRROR_FLOOR}; the rule would pass on an empty loop`);
if (failures.length) {
  console.error("validate_migration_mirror_parity: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_migration_mirror_parity: PASS — ${examined} migrations from ${String(MIRROR_FLOOR).padStart(4, "0")} on, each with exactly one byte-identical mirror, in order.`);
