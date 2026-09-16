import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { listEventRecords } from "@/services/events/eventRepository";

/**
 * The reads the crew deck and the networking page make, run against a REAL runtime event (the
 * newest non-archived one) with the real store — not "__schema_probe__", not the file store.
 * A schema drift the file store cannot see (a table of another shape, a uuid column fed a slug)
 * fails here by name. Row contents are never returned; only whether each read worked.
 */
export interface CrewPageReadsProbe {
  ok: boolean;
  eventId?: string;
  reads: Array<{ name: string; ok: boolean; detail?: string }>;
}

export async function probeCrewPageReads(): Promise<CrewPageReadsProbe> {
  const store = getRuntimeStore();
  const events = await listEventRecords().catch(() => []);
  const event = events.filter((item) => item.source !== "seed" && item.status !== "archived").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!event) return { ok: true, reads: [{ name: "runtime_event", ok: true, detail: "no runtime event to probe yet" }] };
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
  ];
  const results: CrewPageReadsProbe["reads"] = [];
  for (const [name, read] of reads) {
    try { await read(); results.push({ name, ok: true }); } catch (error) { results.push({ name, ok: false, detail: (error instanceof Error ? error.message : String(error)).slice(0, 200) }); }
  }
  return { ok: results.every((item) => item.ok), eventId: event.id, reads: results };
}
