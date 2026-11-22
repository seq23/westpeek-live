import { describe, expect, it } from "vitest";
import {
  buildSpeedNetworkingProducerSummary,
  canMatchEntries,
  createPairHistoryRecord,
  endSpeedNetworkingMatch,
  normalizedSpeedNetworkingPairKey,
  selectNextSpeedNetworkingPair,
} from "@/services/speed-networking/speedNetworkingEngine";
import type { SpeedNetworkingEntry, SpeedNetworkingMatch, SpeedNetworkingPairHistory } from "@/types/speedNetworkingEngine";

const entries: SpeedNetworkingEntry[] = [
  { id: "entry-a", attendeeId: "attendee-a", agencyId: "agency-1", eventId: "event-1", queueId: "queue-1", displayName: "A", status: "waiting", joinedQueueAt: "2026-01-01T00:00:00.000Z" },
  { id: "entry-b", attendeeId: "attendee-b", agencyId: "agency-1", eventId: "event-1", queueId: "queue-1", displayName: "B", status: "waiting", joinedQueueAt: "2026-01-01T00:01:00.000Z" },
  { id: "entry-c", attendeeId: "attendee-c", agencyId: "agency-1", eventId: "event-1", queueId: "queue-1", displayName: "C", status: "waiting", joinedQueueAt: "2026-01-01T00:02:00.000Z" },
];

describe("speed networking engine", () => {
  it("selects eligible pairs and prevents duplicate pairs inside one event", () => {
    expect(canMatchEntries({ first: entries[0], second: entries[1] })).toBe(true);
    expect(normalizedSpeedNetworkingPairKey("event-1", entries[0], entries[1])).toBe(normalizedSpeedNetworkingPairKey("event-1", entries[1], entries[0]));
    expect(canMatchEntries({ first: entries[0], second: entries[1], recentPairs: [["attendee-b", "attendee-a"]] })).toBe(false);
    expect(selectNextSpeedNetworkingPair(entries)?.map((entry) => entry.id)).toEqual(["entry-a", "entry-b"]);
  });

  it("uses event-scoped pair history and does not silently recycle exhausted pairs", () => {
    const history: SpeedNetworkingPairHistory[] = [
      { eventId: "event-1", normalizedPairKey: normalizedSpeedNetworkingPairKey("event-1", entries[0], entries[1]), attendeeAId: "attendee-a", attendeeBId: "attendee-b", firstMatchedAt: "2026-01-01T00:03:00.000Z", matchId: "match-ab" },
      { eventId: "event-1", normalizedPairKey: normalizedSpeedNetworkingPairKey("event-1", entries[0], entries[2]), attendeeAId: "attendee-a", attendeeBId: "attendee-c", firstMatchedAt: "2026-01-01T00:06:00.000Z", matchId: "match-ac" },
      { eventId: "event-1", normalizedPairKey: normalizedSpeedNetworkingPairKey("event-1", entries[1], entries[2]), attendeeAId: "attendee-b", attendeeBId: "attendee-c", firstMatchedAt: "2026-01-01T00:09:00.000Z", matchId: "match-bc" },
    ];
    expect(selectNextSpeedNetworkingPair(entries, [], history)).toBeNull();
    const otherEventA = { ...entries[0], eventId: "event-2" };
    const otherEventB = { ...entries[1], eventId: "event-2" };
    expect(canMatchEntries({ first: otherEventA, second: otherEventB, pairHistory: history })).toBe(true);
  });

  it("ends matches, creates pair history, and summarizes queue state", () => {
    const match: SpeedNetworkingMatch = {
      id: "match-1",
      agencyId: "agency-1",
      eventId: "event-1",
      queueId: "queue-1",
      participantAEntryId: "entry-a",
      participantBEntryId: "entry-b",
      normalizedPairKey: normalizedSpeedNetworkingPairKey("event-1", entries[0], entries[1]),
      status: "active",
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:03:00.000Z",
    };

    expect(endSpeedNetworkingMatch(match, "expired").status).toBe("expired");
    expect(createPairHistoryRecord(match, entries[0], entries[1]).normalizedPairKey).toBe(match.normalizedPairKey);

    const summary = buildSpeedNetworkingProducerSummary({ eventId: "event-1", queueId: "queue-1", entries, matches: [match], reportCount: 1 });
    expect(summary.waitingCount).toBe(3);
    expect(summary.activeMatchCount).toBe(1);
    expect(summary.reportCount).toBe(1);
  });
});
