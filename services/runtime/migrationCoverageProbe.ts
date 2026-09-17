import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { RUNTIME_TABLE_MIGRATIONS } from "@/types/runtimeEvent";

/**
 * Does the live database actually have everything RUNTIME_TABLE_MIGRATIONS says a migration put
 * there? The older probe in getRuntimeSchemaStatus() ran a hand-written list of fourteen reads, so
 * the other forty entries in the map were never checked against production at all. Migrations 0030,
 * 0037 and 0023 each sat unapplied for days behind exactly that gap.
 *
 * This checks EVERY entry in the map, and it does it per table rather than per object: one PostgREST
 * read per table naming all of that table's mapped columns, thirteen requests for fifty-three objects
 * rather than fifty-three. PostgREST validates the whole select list before it executes, so a single
 * `limit=0` read tells us both that the table is there and that the columns are, and names the first
 * one that is not. Nothing is fetched: `head: true` with `limit(0)` returns no rows.
 */
export interface MigrationCoverageProbe {
  ok: boolean;
  /** How many map entries were actually checked. Zero is a failure, not a pass. */
  checked: number;
  missing: Array<{ object: string; migrationFile: string; detail: string }>;
  detail?: string;
}

/** `runtime_events` and `runtime_events.attendee_session_days` both belong to the runtime_events read. */
function groupByTable(): Map<string, { columns: string[]; objects: Map<string, string> }> {
  const groups = new Map<string, { columns: string[]; objects: Map<string, string> }>();
  for (const [key, migrationFile] of Object.entries(RUNTIME_TABLE_MIGRATIONS)) {
    const dot = key.indexOf(".");
    const table = dot < 0 ? key : key.slice(0, dot);
    const column = dot < 0 ? undefined : key.slice(dot + 1);
    const group = groups.get(table) || { columns: [], objects: new Map<string, string>() };
    if (column) group.columns.push(column);
    group.objects.set(key, migrationFile);
    groups.set(table, group);
  }
  return groups;
}

export async function probeMigrationCoverage(): Promise<MigrationCoverageProbe> {
  const entries = Object.keys(RUNTIME_TABLE_MIGRATIONS).length;
  // An empty map would otherwise report a clean bill of health for a database nobody looked at.
  if (!entries) return { ok: false, checked: 0, missing: [], detail: "RUNTIME_TABLE_MIGRATIONS is empty; there is nothing to prove and this is a failure, not a pass" };
  if (getRuntimeStore().kind !== "supabase") {
    return { ok: false, checked: 0, missing: [], detail: "the file runtime store is active, so no migration state can be read; production must run the supabase store" };
  }

  let client;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    return { ok: false, checked: 0, missing: [], detail: error instanceof Error ? error.message : String(error) };
  }

  const missing: MigrationCoverageProbe["missing"] = [];
  let checked = 0;
  for (const [table, group] of Array.from(groupByTable().entries())) {
    // Naming the columns proves the table too: PostgREST cannot resolve a column on a table it cannot see.
    const select = group.columns.length ? group.columns.join(",") : "*";
    const { error } = await client.from(table).select(select, { head: true }).limit(0);
    checked += group.objects.size;
    if (!error) continue;
    // PostgREST: PGRST205/42P01 for a table it cannot see, 42703 for a column that is not there.
    // Either way the whole group is unproven, so name the table's objects with the file that supplies them.
    const detail = `${error.code || "error"}: ${error.message}`.slice(0, 200);
    const columnMatch = /column\s+"?([a-z0-9_]+)"?\s+.*does not exist/i.exec(error.message || "");
    const named = columnMatch ? `${table}.${columnMatch[1]}` : table;
    if (group.objects.has(named)) missing.push({ object: named, migrationFile: RUNTIME_TABLE_MIGRATIONS[named], detail });
    else for (const [object, migrationFile] of Array.from(group.objects.entries())) missing.push({ object, migrationFile, detail });
  }

  if (!checked) return { ok: false, checked: 0, missing, detail: "the coverage probe checked zero objects; it must never pass on an empty loop" };
  return { ok: missing.length === 0, checked, missing };
}
