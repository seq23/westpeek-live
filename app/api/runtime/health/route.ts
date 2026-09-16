import { NextResponse } from "next/server";
import { getRuntimeSchemaStatus, listSeedEventRecords } from "@/services/events/eventRepository";
import { probeCrewPageReads } from "@/services/events/crewPageReadsProbe";
import { probeMigrationCoverage } from "@/services/runtime/migrationCoverageProbe";

export const dynamic = "force-dynamic";

/**
 * Public, read-only runtime readiness. No secrets, no row contents: which store
 * is active, whether the runtime tables from migration 0024 exist, and how many
 * compiled seed events still resolve — and `crewPageReads`: the reads the crew
 * deck and the networking page make, against the newest real runtime event with
 * the real store, so a schema drift the local file store cannot see fails here by
 * name. The post-deploy proof reads this so a missing or mis-shaped table is a
 * named, visible stop rather than a 500 on the crew page during a show.
 *
 * `migrationCoverage` is the whole of it: EVERY entry in RUNTIME_TABLE_MIGRATIONS —
 * every table and every column any migration from 0023 on introduces — checked
 * against the live database, each missing object reported with the migration file
 * that supplies it. The older checks covered fourteen hand-listed objects out of
 * fifty-three, which is how 0023, 0030 and 0037 stayed unapplied and unnoticed.
 */
export async function GET() {
  let schema;
  try {
    schema = await getRuntimeSchemaStatus();
  } catch (error) {
    schema = { ok: false, store: "unknown", missingTables: [], migrationFile: "db/migrations/0024_runtime_events.sql", detail: error instanceof Error ? error.message : String(error) };
  }
  const seedEvents = listSeedEventRecords().length;
  const crewPageReads = await probeCrewPageReads().catch((error) => ({ ok: false, reads: [{ name: "probe", ok: false, detail: error instanceof Error ? error.message : String(error) }] }));
  // A thrown probe is a failed probe, never an absent one: `ok: false` so the smoke test still stops.
  const migrationCoverage = await probeMigrationCoverage().catch((error) => ({ ok: false, checked: 0, missing: [], detail: error instanceof Error ? error.message : String(error) }));
  return NextResponse.json(
    {
      ok: schema.ok && crewPageReads.ok && migrationCoverage.ok,
      crewPageReads,
      migrationCoverage,
      store: schema.store,
      runtimeEvents: { ready: schema.ok, missingTables: schema.missingTables, migrationFile: schema.migrationFile, detail: schema.detail },
      seedEvents,
      checkedAt: new Date().toISOString(),
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
