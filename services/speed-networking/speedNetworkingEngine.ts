import type { SpeedNetworkingEntry, SpeedNetworkingMatch, SpeedNetworkingPairHistory, SpeedNetworkingProducerSummary } from "@/types/speedNetworkingEngine";

function participantKey(entry: SpeedNetworkingEntry) {
  return entry.attendeeId || entry.id;
}

export function normalizedSpeedNetworkingPairKey(eventId: string, first: SpeedNetworkingEntry | string, second: SpeedNetworkingEntry | string) {
  const firstId = typeof first === "string" ? first : participantKey(first);
  const secondId = typeof second === "string" ? second : participantKey(second);
  return [firstId, secondId].sort().join("::").replace(/^/, `${eventId}::`);
}

export function hasPairAlreadyMet(input: { eventId: string; first: SpeedNetworkingEntry; second: SpeedNetworkingEntry; pairHistory?: SpeedNetworkingPairHistory[]; recentPairs?: Array<[string, string]>; }) {
  const key = normalizedSpeedNetworkingPairKey(input.eventId, input.first, input.second);
  if ((input.pairHistory || []).some((item) => item.eventId === input.eventId && item.normalizedPairKey === key)) return true;
  return (input.recentPairs ?? []).some((pair) => normalizedSpeedNetworkingPairKey(input.eventId, pair[0], pair[1]) === key);
}

export function canMatchEntries(input: {
  first: SpeedNetworkingEntry;
  second: SpeedNetworkingEntry;
  recentPairs?: Array<[string, string]>;
  pairHistory?: SpeedNetworkingPairHistory[];
}) {
  if (participantKey(input.first) === participantKey(input.second)) return false;
  if (input.first.eventId !== input.second.eventId) return false;
  if (input.first.status !== "waiting" || input.second.status !== "waiting") return false;
  return !hasPairAlreadyMet({ eventId: input.first.eventId, first: input.first, second: input.second, recentPairs: input.recentPairs, pairHistory: input.pairHistory });
}

export function selectNextSpeedNetworkingPair(entries: SpeedNetworkingEntry[], recentPairs: Array<[string, string]> = [], pairHistory: SpeedNetworkingPairHistory[] = []) {
  const waiting = entries.filter((entry) => entry.status === "waiting").sort((a, b) => a.joinedQueueAt.localeCompare(b.joinedQueueAt));
  for (let i = 0; i < waiting.length; i += 1) {
    for (let j = i + 1; j < waiting.length; j += 1) {
      if (canMatchEntries({ first: waiting[i], second: waiting[j], recentPairs, pairHistory })) {
        return [waiting[i], waiting[j]] as const;
      }
    }
  }
  return null;
}

export function createPairHistoryRecord(match: SpeedNetworkingMatch, participantA: SpeedNetworkingEntry, participantB: SpeedNetworkingEntry): SpeedNetworkingPairHistory {
  const [attendeeAId, attendeeBId] = [participantKey(participantA), participantKey(participantB)].sort();
  return {
    eventId: match.eventId,
    normalizedPairKey: match.normalizedPairKey,
    attendeeAId,
    attendeeBId,
    firstMatchedAt: match.startsAt,
    matchId: match.id,
  };
}

export function endSpeedNetworkingMatch(match: SpeedNetworkingMatch, reason: string): SpeedNetworkingMatch {
  return {
    ...match,
    status: reason === "expired" ? "expired" : "ended",
    endsAt: new Date().toISOString(),
    endedReason: reason,
  };
}

export function buildSpeedNetworkingProducerSummary(input: {
  eventId: string;
  queueId: string;
  entries: SpeedNetworkingEntry[];
  matches: SpeedNetworkingMatch[];
  reportCount?: number;
}): SpeedNetworkingProducerSummary {
  const activeMatches = input.matches.filter((match) => match.status === "created" || match.status === "active");

  return {
    eventId: input.eventId,
    queueId: input.queueId,
    waitingCount: input.entries.filter((entry) => entry.status === "waiting").length,
    activeMatchCount: activeMatches.length,
    reportCount: input.reportCount ?? 0,
    averageMatchDurationSeconds: 180,
  };
}
