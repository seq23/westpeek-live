import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { listEventRecords } from "@/services/events/eventRepository";

/**
 * The event id every crew-page read is made against. Synthetic on purpose: /api/runtime/health is
 * public, and until 31 Oct 2026 it named the newest real client event (a person's name in the
 * slug) to anyone who asked. D1 does not type-check `event_id`, so a read keyed on this id runs the
 * same SQL against the same tables and columns as a read keyed on a real event — a missing table
 * or column still fails by name — while matching no client row and naming no client.
 */
export const HEALTH_PROBE_EVENT_ID = "__health_probe__";

/**
 * The reads the crew deck and the networking page make, run with the real store (never the file
 * store) against HEALTH_PROBE_EVENT_ID. A schema drift the file store cannot see fails here by
 * name. Row contents are never returned, and no real event id is either; only whether each read
 * worked. tests/unit/healthNoClientIds.test.ts pins this.
 */
export interface CrewPageReadsProbe {
  ok: boolean;
  eventId?: typeof HEALTH_PROBE_EVENT_ID;
  reads: Array<{ name: string; ok: boolean; detail?: string }>;
}

export async function probeCrewPageReads(): Promise<CrewPageReadsProbe> {
  const store = getRuntimeStore();
  // A store that cannot list events is a failed probe, never "nothing to probe yet": swallowing this
  // read reported ok:true for a day while the database behind it was gone (6 Oct 2026).
  // The rows are never used or returned: the list read itself is the runtime_events check.
  try {
    await listEventRecords();
  } catch (error) {
    return { ok: false, reads: [{ name: "runtime_events", ok: false, detail: (error instanceof Error ? error.message : String(error)).slice(0, 200) }] };
  }
  const event = { id: HEALTH_PROBE_EVENT_ID };
  const reads: Array<[string, () => Promise<unknown>]> = [
    ["attendee_profiles", () => store.listAttendeeProfiles(event.id, 5)],
    ["attendee_live_capabilities", () => store.listAttendeeLiveCapabilities(event.id)],
    ["live_chat_messages", () => store.listRecentLiveChatMessages(event.id, 5)],
    ["live_chat_moderation_states", () => store.listLiveChatModerationStates(event.id)],
    ["special_guest_profiles", () => store.listSpecialGuestProfiles(event.id)],
    ["event_guest_states", () => store.listEventGuestStates(event.id)],
    ["stage_stream_events", () => store.listStageStreamEvents(event.id, "main-stage", 3)],
    ["networking_queue_entries", () => store.listSpeedNetworkingEntries(event.id)],
    ["networking_queue_matches", () => store.listSpeedNetworkingMatches(event.id)],
    // contacts.archived_at (migration 0030): a COLUMN, not a table. A read of just that column
    // fails by name when the D1 migration has not been applied — which is how "Archive test
    // rows" came to press against a column that was not there.
    ["contacts_archived_at", () => store.probeContactsArchiveColumn()],
  ];
  const results: CrewPageReadsProbe["reads"] = [];
  for (const [name, read] of reads) {
    try { await read(); results.push({ name, ok: true }); } catch (error) { results.push({ name, ok: false, detail: (error instanceof Error ? error.message : String(error)).slice(0, 200) }); }
  }
  return { ok: results.every((item) => item.ok), eventId: HEALTH_PROBE_EVENT_ID, reads: results };
}
