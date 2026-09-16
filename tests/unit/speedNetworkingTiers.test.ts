import { describe, expect, it } from "vitest";
import {
  SPEED_NETWORKING_MATCHING_CONFIG,
  planSpeedNetworkingRound,
  readGoalIntents,
  scoreSpeedNetworkingPair,
  selectSpeedNetworkingTier,
  type SpeedNetworkingCandidate,
} from "@/services/speed-networking/speedNetworkingTiers";
import type { SpeedNetworkingPairHistory } from "@/types/speedNetworkingEngine";

/**
 * Tiered matching (16 Sep 2026). Longest-waiting first is right for a small room and wrong for a
 * big one, so the method follows the size of the queue; whatever the tier, two people from the
 * same company are never paired, a pair never meets twice unless both asked to, the odd person out
 * is told they are next and leads the following round, and somebody who has met everyone is told
 * so rather than left in a queue that cannot resolve.
 */
const EVENT = "tier-event";
const NOW = Date.parse("2026-09-16T20:00:00.000Z");

function waitedFor(minutes: number) {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function person(id: string, overrides: Partial<SpeedNetworkingCandidate> = {}): SpeedNetworkingCandidate {
  return { attendeeId: id, displayName: id, company: `${id} co`, joinedAt: waitedFor(1), ...overrides };
}

function queueOf(size: number, overrides: (index: number) => Partial<SpeedNetworkingCandidate> = () => ({})) {
  return Array.from({ length: size }, (_, index) => person(`att-${String(index).padStart(2, "0")}`, { joinedAt: waitedFor(size - index), ...overrides(index) }));
}

function historyFor(pairs: Array<[string, string]>): SpeedNetworkingPairHistory[] {
  return pairs.map(([a, b], index) => ({
    eventId: EVENT,
    normalizedPairKey: `${EVENT}::${[a, b].sort().join("::")}`,
    attendeeAId: [a, b].sort()[0],
    attendeeBId: [a, b].sort()[1],
    firstMatchedAt: new Date(NOW - 600_000).toISOString(),
    matchId: `match-${index}`,
  }));
}

/** A fixed source so a round replays identically; the real matcher passes Math.random. */
function fixedRandom(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("speed networking tiers", () => {
  describe("the tier follows the size of the queue", () => {
    it("picks longest-waiting FIFO under twelve, weighted random through fifty, scored above that", () => {
      expect(selectSpeedNetworkingTier(0)).toBe("fifo");
      expect(selectSpeedNetworkingTier(11)).toBe("fifo");
      expect(selectSpeedNetworkingTier(12)).toBe("weighted_random");
      expect(selectSpeedNetworkingTier(50)).toBe("weighted_random");
      expect(selectSpeedNetworkingTier(51)).toBe("scored");
      // The thresholds live in one config object, not scattered through the matcher.
      expect(SPEED_NETWORKING_MATCHING_CONFIG.tiers).toEqual({ fifoBelowWaiting: 12, weightedRandomThroughWaiting: 50 });
    });

    it("reports the tier it actually used for the round", () => {
      for (const [size, tier] of [[6, "fifo"], [20, "weighted_random"], [60, "scored"]] as const) {
        const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting: queueOf(size), pairHistory: [], nowMs: NOW, random: fixedRandom([0.5]) });
        expect(plan.tier).toBe(tier);
        expect(plan.pairs.length).toBe(Math.floor(size / 2));
      }
    });
  });

  describe("the score", () => {
    it("reads networking goals as intent, and pays most for shared topics", () => {
      expect(readGoalIntents("We are hiring three engineers")).toContain("hiring");
      expect(readGoalIntents("Looking for a new role")).toContain("job_seeking");
      const shared = scoreSpeedNetworkingPair(
        person("a", { topicsOfInterest: ["AI", "Fundraising", "Hiring"], joinedAt: waitedFor(0) }),
        person("b", { topicsOfInterest: ["ai", "fundraising", "hiring"], joinedAt: waitedFor(0) }),
        NOW,
      );
      expect(shared.sharedTopics).toEqual(["ai", "fundraising", "hiring"]);
      expect(shared.score).toBe(30);
    });

    it("pays for complementary goals and less for merely shared ones", () => {
      const complementary = scoreSpeedNetworkingPair(person("a", { networkingGoals: "We are hiring", joinedAt: waitedFor(0) }), person("b", { networkingGoals: "Looking for a new role", joinedAt: waitedFor(0) }), NOW);
      const same = scoreSpeedNetworkingPair(person("a", { networkingGoals: "We are hiring", joinedAt: waitedFor(0) }), person("b", { networkingGoals: "We are hiring too", joinedAt: waitedFor(0) }), NOW);
      expect(complementary.complementary).toBe(true);
      expect(complementary.score).toBe(6);
      expect(same.complementary).toBe(false);
      expect(same.score).toBe(3);
    });

    it("scores a same-company pair at nothing however well they match", () => {
      const scored = scoreSpeedNetworkingPair(
        person("a", { company: "Cargill, Inc.", topicsOfInterest: ["ai"], joinedAt: waitedFor(30) }),
        person("b", { company: "cargill inc", topicsOfInterest: ["ai"], joinedAt: waitedFor(30) }),
        NOW,
      );
      expect(scored.sameCompany).toBe(true);
      expect(scored.score).toBe(0);
    });

    it("lets wait time eventually beat the best possible affinity", () => {
      const perfectButFresh = scoreSpeedNetworkingPair(
        person("a", { topicsOfInterest: ["x", "y", "z"], networkingGoals: "hiring", joinedAt: waitedFor(0) }),
        person("b", { topicsOfInterest: ["x", "y", "z"], networkingGoals: "looking for a new role", joinedAt: waitedFor(0) }),
        NOW,
      );
      const nothingInCommonButWaiting = scoreSpeedNetworkingPair(person("c", { joinedAt: waitedFor(10) }), person("d", { joinedAt: waitedFor(10) }), NOW);
      expect(perfectButFresh.score).toBe(36);
      expect(nothingInCommonButWaiting.score).toBeGreaterThan(perfectButFresh.score);
    });
  });

  describe("every tier obeys the same rules", () => {
    it("never pairs two people from the same company, at any tier", () => {
      for (const size of [6, 20, 60]) {
        // Everybody works at one of two companies, so a careless matcher pairs colleagues immediately.
        const waiting = queueOf(size, (index) => ({ company: index % 2 === 0 ? "Cargill" : "West Peek" }));
        const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: [], nowMs: NOW, random: fixedRandom([0.1, 0.9, 0.4]) });
        expect(plan.pairs.length).toBeGreaterThan(0);
        for (const pair of plan.pairs) expect(pair.first.company).not.toBe(pair.second.company);
      }
    });

    it("never repeats a pair, at any tier", () => {
      for (const size of [6, 20, 60]) {
        const waiting = queueOf(size);
        const first = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: [], nowMs: NOW, random: fixedRandom([0.3]) });
        const history = historyFor(first.pairs.map((pair) => [pair.first.attendeeId, pair.second.attendeeId] as [string, string]));
        const second = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: history, nowMs: NOW, random: fixedRandom([0.3]) });
        const met = new Set(history.map((item) => item.normalizedPairKey));
        for (const pair of second.pairs) expect(met.has(`${EVENT}::${[pair.first.attendeeId, pair.second.attendeeId].sort().join("::")}`)).toBe(false);
      }
    });

    it("pairs the whole queue in one deterministic batch: the same queue replays identically", () => {
      const waiting = queueOf(20);
      const run = () => planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: [], nowMs: NOW, random: fixedRandom([0.17, 0.83, 0.42, 0.61]) }).pairs.map((pair) => `${pair.first.attendeeId}+${pair.second.attendeeId}`);
      expect(run()).toEqual(run());
      expect(run()).toHaveLength(10);
    });
  });

  describe("nobody is left in a queue that cannot resolve", () => {
    it("names the odd person out so they can be told they are next, and leads them next round", () => {
      const waiting = queueOf(5);
      const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: [], nowMs: NOW });
      expect(plan.pairs).toHaveLength(2);
      expect(plan.oddOneOut).toBeDefined();
      const oddId = plan.oddOneOut!.attendeeId;
      // Given the priority flag the next round puts them first, even though they are now the freshest.
      const nextRound = planSpeedNetworkingRound({
        eventId: EVENT,
        waiting: waiting.map((candidate) => (candidate.attendeeId === oddId ? { ...candidate, joinedAt: waitedFor(0), priority: true } : candidate)),
        pairHistory: [],
        nowMs: NOW,
      });
      expect(nextRound.pairs[0].first.attendeeId).toBe(oddId);
    });

    it("says who has met everyone instead of leaving them waiting, and pairs them again only when both opt in", () => {
      const waiting = [person("att-a", { joinedAt: waitedFor(9) }), person("att-b", { joinedAt: waitedFor(8) })];
      const history = historyFor([["att-a", "att-b"]]);
      const stuck = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: history, nowMs: NOW });
      expect(stuck.pairs).toHaveLength(0);
      expect(stuck.metEveryone.map((candidate) => candidate.attendeeId)).toEqual(["att-a", "att-b"]);
      // Somebody who can never be served is not the "odd one out" — that would promise them a next round.
      expect(stuck.oddOneOut).toBeUndefined();

      const onlyOneAsked = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: history, repeatOptIn: ["att-a"], nowMs: NOW });
      expect(onlyOneAsked.pairs).toHaveLength(0);

      const bothAsked = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: history, repeatOptIn: ["att-a", "att-b"], nowMs: NOW });
      expect(bothAsked.pairs).toHaveLength(1);
      expect(bothAsked.metEveryone).toHaveLength(0);
    });

    it("counts colleagues as met-everyone too: two people from one company alone in the queue can never be paired", () => {
      const waiting = [person("att-a", { company: "Cargill" }), person("att-b", { company: "Cargill" })];
      const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: [], nowMs: NOW });
      expect(plan.pairs).toHaveLength(0);
      expect(plan.metEveryone).toHaveLength(2);
    });
  });

  describe("weighted random spreads the pairings", () => {
    it("draws different partners for the same seed from different random sources", () => {
      const waiting = queueOf(20);
      const low = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: [], nowMs: NOW, random: fixedRandom([0.01]) });
      const high = planSpeedNetworkingRound({ eventId: EVENT, waiting, pairHistory: [], nowMs: NOW, random: fixedRandom([0.99]) });
      expect(low.tier).toBe("weighted_random");
      expect(low.pairs[0].second.attendeeId).not.toBe(high.pairs[0].second.attendeeId);
      // And it never reaches outside the longest-waiting half of the options.
      expect(low.pairs[0].first.attendeeId).toBe(high.pairs[0].first.attendeeId);
    });
  });
});
