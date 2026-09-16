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

/**
 * The rotation (16 Sep 2026, the owner: "it should continually keep u in a 4 min cycle of talking
 * to new people"). Finishing a match puts both people at the back of the queue; the person an odd
 * round could not seat keeps their place and leads the next one.
 *
 * These fixtures give everyone the SAME join time on purpose: that is a roomful pressing Join the
 * moment the crew opens networking, and it is the case where "goes to the back" and "nobody
 * starves" pull against each other. With nothing to sort on, the priority flag alone leaves the
 * same person out repeatedly — 3 of 7 rounds before the sit-out debt was tracked. With distinct
 * join times the pre-existing rotation already held; the debt is what makes it hold either way.
 */
describe("the rotation over many rounds", () => {
  /** One round: pair everybody it can, then requeue exactly the way the service does. */
  function playRounds(people: number, rounds: number) {
    let clock = NOW;
    let queue = queueOf(people).map((candidate) => ({ ...candidate, joinedAt: waitedFor(people) }));
    const history: SpeedNetworkingPairHistory[] = [];
    const satOut: string[] = [];
    const met = new Map<string, number>();
    for (let round = 0; round < rounds; round += 1) {
      const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting: queue, pairHistory: history, nowMs: clock, random: fixedRandom([0.5, 0.2, 0.8]) });
      for (const pair of plan.pairs) {
        history.push(...historyFor([[pair.first.attendeeId, pair.second.attendeeId]]));
        for (const id of [pair.first.attendeeId, pair.second.attendeeId]) met.set(id, (met.get(id) || 0) + 1);
      }
      satOut.push(plan.oddOneOut?.attendeeId ?? plan.unmatched.map((candidate) => candidate.attendeeId).join("+"));
      // The match runs; everyone who was in one goes to the back, whoever sat out keeps their place.
      clock += 4 * 60_000;
      const paired = new Set(plan.pairs.flatMap((pair) => [pair.first.attendeeId, pair.second.attendeeId]));
      const oddId = plan.oddOneOut?.attendeeId;
      queue = queue.map((candidate) => ({
        ...candidate,
        joinedAt: paired.has(candidate.attendeeId) ? new Date(clock).toISOString() : candidate.joinedAt,
        priority: candidate.attendeeId === oddId,
        timesSatOut: (candidate.timesSatOut || 0) + (candidate.attendeeId === oddId ? 1 : 0),
      }));
    }
    return { satOut, met };
  }

  /**
   * Measured with these simultaneous-join fixtures once the sit-out debt leads the queue:
   *   3 waiting, 3 rounds — sat out att-02, att-01, att-00; everyone matched twice.
   *   5 waiting, 5 rounds — every person sits out exactly once; everyone matched four times.
   *   7 waiting, 7 rounds — matched 6,6,6,5,6,5,6; nobody sits out twice running.
   * Without the debt the 7-person case sits one person out 3 rounds of 7 (this test catches it).
   */
  for (const people of [3, 5, 7]) {
    it(`rotates the person left over with ${people} waiting: never the same one twice running, and everyone gets matched`, () => {
      // An odd-sized round robin takes n rounds for everyone to sit out exactly once.
      const rounds = people;
      const { satOut, met } = playRounds(people, rounds);
      expect(satOut).toHaveLength(rounds);
      for (let index = 1; index < satOut.length; index += 1) {
        expect(satOut[index], `round ${index} sat out the same person as round ${index - 1}`).not.toBe(satOut[index - 1]);
      }
      // Nobody starves: over a full rotation every single person has been in a match.
      expect(met.size).toBe(people);
      const counts = Array.from(met.values());
      expect(Math.min(...counts)).toBeGreaterThan(0);
      // And the load is even to within one round — no one is matched far less than anyone else.
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });
  }

  it("keeps the wait-time weighting honest across a rotation: a long waiter outscores a fresh pairing", () => {
    const justFinished = person("att-fresh", { joinedAt: waitedFor(0), topicsOfInterest: ["ai", "ml", "data"] });
    const stillWaiting = person("att-patient", { joinedAt: waitedFor(12) });
    const other = person("att-other", { joinedAt: waitedFor(11) });
    expect(scoreSpeedNetworkingPair(stillWaiting, other, NOW).score).toBeGreaterThan(scoreSpeedNetworkingPair(justFinished, other, NOW).score);
  });

  it("keeps the cycle in the same named config as the tiers", () => {
    expect(SPEED_NETWORKING_MATCHING_CONFIG.cycle).toMatchObject({ setupGapSeconds: 9, tokenLeadSeconds: 2, idlePollMs: 5_000, transitionPollMs: 1_000, transitionWindowSeconds: 15 });
    expect(SPEED_NETWORKING_MATCHING_CONFIG.cycle.setupGapSeconds).toBeGreaterThanOrEqual(8);
    expect(SPEED_NETWORKING_MATCHING_CONFIG.cycle.setupGapSeconds).toBeLessThanOrEqual(10);
  });
});
