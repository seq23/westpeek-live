import { NextResponse } from "next/server";
import { getRuntimeSchemaStatus, listSeedEventRecords } from "@/services/events/eventRepository";

export const dynamic = "force-dynamic";

/**
 * Public, read-only runtime readiness. No secrets, no row contents: which store
 * is active, whether the runtime tables from migration 0024 exist, and how many
 * compiled seed events still resolve. The post-deploy proof reads this so a
 * missing migration is a named, visible stop rather than a silent failure.
 */
export async function GET() {
  let schema;
  try {
    schema = await getRuntimeSchemaStatus();
  } catch (error) {
    schema = { ok: false, store: "unknown", missingTables: [], migrationFile: "db/migrations/0024_runtime_events.sql", detail: error instanceof Error ? error.message : String(error) };
  }
  const seedEvents = listSeedEventRecords().length;
  return NextResponse.json(
    {
      ok: schema.ok,
      store: schema.store,
      runtimeEvents: { ready: schema.ok, missingTables: schema.missingTables, migrationFile: schema.migrationFile, detail: schema.detail },
      seedEvents,
      checkedAt: new Date().toISOString(),
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
