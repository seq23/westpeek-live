import { getD1 } from "@/lib/d1/binding";
import type { D1DatabaseLike } from "@/lib/d1/query";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { RUNTIME_TABLE_MIGRATIONS } from "@/types/runtimeEvent";

/**
 * Does the live D1 database actually have every table and every column migrations-d1/ declares?
 * RUNTIME_TABLE_MIGRATIONS is derived from the migration SQL itself (lib/d1/schema.generated.ts), so
 * this checks the whole schema, not a hand-picked list — the Postgres-era probe checked fourteen of
 * fifty-three objects and three migrations sat unapplied behind that gap.
 *
 * One round trip: `sqlite_master` for the tables, then `PRAGMA table_info` for each expected table in
 * one batch. A database that cannot be reached throws, and the health route turns that into ok:false
 * and a 503 — never a pass.
 */
export interface MigrationCoverageProbe {
  ok: boolean;
  /** How many map entries were actually checked. Zero is a failure, not a pass. */
  checked: number;
  missing: Array<{ object: string; migrationFile: string; detail: string }>;
  detail?: string;
}

export async function probeMigrationCoverageOn(db: D1DatabaseLike): Promise<MigrationCoverageProbe> {
  const entries = Object.entries(RUNTIME_TABLE_MIGRATIONS);
  if (!entries.length) return { ok: false, checked: 0, missing: [], detail: "RUNTIME_TABLE_MIGRATIONS is empty; there is nothing to prove and this is a failure, not a pass" };
  const tables = Array.from(new Set(entries.map(([key]) => key.split(".")[0])));
  for (const table of tables) if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`refused table name ${table}`);
  const results = await db.batch(tables.map((table) => db.prepare(`PRAGMA table_info("${table}")`)));
  const present = new Map<string, Set<string>>();
  tables.forEach((table, index) => {
    const rows = (results[index]?.results || []) as Array<{ name?: string }>;
    if (rows.length) present.set(table, new Set(rows.map((row) => String(row.name))));
  });
  const missing: MigrationCoverageProbe["missing"] = [];
  let checked = 0;
  for (const [object, migrationFile] of entries) {
    checked += 1;
    const [table, column] = object.split(".");
    const columns = present.get(table);
    if (!columns) missing.push({ object, migrationFile, detail: `no such table: ${table}` });
    else if (column && !columns.has(column)) missing.push({ object, migrationFile, detail: `no such column: ${object}` });
  }
  if (!checked) return { ok: false, checked: 0, missing, detail: "the coverage probe checked zero objects; it must never pass on an empty loop" };
  return { ok: missing.length === 0, checked, missing };
}

export async function probeMigrationCoverage(): Promise<MigrationCoverageProbe> {
  if (getRuntimeStore().kind !== "d1") {
    return { ok: false, checked: 0, missing: [], detail: "the file runtime store is active, so no migration state can be read; production must run the d1 store (binding DB)" };
  }
  const db = getD1();
  if (!db) return { ok: false, checked: 0, missing: [], detail: "D1 binding DB is not available" };
  return probeMigrationCoverageOn(db);
}
