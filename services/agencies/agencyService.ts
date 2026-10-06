import { decodeRow, type DbClient } from "@/lib/d1/query";
import type { DbAgencyRecord } from "@/types/persistence";
import { mapAgencyRecord } from "@/services/persistence/mapRecords";

/** The agencies a user is an active member of: one join, so a membership row never reads alone. */
export async function listAgenciesForUser(client: DbClient, userId: string) {
  try {
    const { results } = await client.db
      .prepare('SELECT a.* FROM "agency_members" m JOIN "agencies" a ON a."id" = m."agency_id" WHERE m."user_id" = ? AND m."status" = ?')
      .bind(userId, "active")
      .all<Record<string, unknown>>();
    return { data: results.map((row) => mapAgencyRecord(decodeRow("agencies", row) as unknown as DbAgencyRecord)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), data: [] };
  }
}

export async function getAgencyById(client: DbClient, agencyId: string) {
  const { data, error } = await client.from("agencies").select("*").eq("id", agencyId).maybeSingle();
  if (error) return { error: error.message };
  return { data: data ? mapAgencyRecord(data as DbAgencyRecord) : undefined };
}
