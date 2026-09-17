import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Simultaneous-join fairness (16 Sep 2026). When the crew opens networking during a show a roomful
 * presses Join in the same second, so every queue entry carries the same joinedAt and there is
 * nothing left to sort on: the tie-break is arbitrary and, worse, STABLE. Whether the same person
 * is left out over and over then has to be a property of the algorithm rather than an accident of
 * whose row happened to be written first.
 *
 * This is a simulation, not a spot check. N people join in one tick, the real matcher runs M
 * rounds against the real store, and the assertion is on the shape of the whole distribution: the
 * sit-out counts differ by at most one between any two people, and nobody sits out twice running.
 * Math.random is seeded so the weighted-random tier replays identically.
 *
 * Measured on this simulation before the fix (the source at 73d120b), sit-outs per attendee over
 * 12 rounds:
 *   3 waiting  [4,4,4]                                spread 0   fair already
 *   5 waiting  [2,2,2,3,3]                            spread 1   fair already
 *   7 waiting  [1,1,2,2,2,2,2]                        spread 1   fair already
 *   9 waiting  [1,1,1,1,1,1,2,2,2]                    spread 1   fair already
 *  12 waiting  nobody sits out                        spread 0   fair already
 *  13 waiting  [0,0,1,0,1,1,1,1,1,1,1,2,2]            spread 2   FAILS
 *  51 waiting  [0 x 39, 1 x 12]                       spread 1   fair on a flat fixture
 * The FIFO tier was already fair end to end, and for a reason rather than luck: ending a match
 * requeues both attendees with a fresh joinedAt, so whoever sat out keeps the oldest timestamp and
 * leads the next round — the simultaneity only survives the first round there. It is the two tiers
 * that do NOT pair straight down the queue that were broken: weighted random above 12 waiting, and
 * scored above 50, where the leftover was whoever the draw or the affinity score happened not to
 * take. The scored tier survives a flat fixture and fails a realistic one, which is why it has a
 * test of its own below rather than only a place in the table. After the fix every row is 1 or 0.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { allowRepeatNetworkingMatch, getMyNetworkingState, getNetworkingRoundState, joinNetworkingQueue, runNetworkingMatcher } from "@/services/speed-networking/speedNetworkingService";
import { SPEED_NETWORKING_MATCHING_CONFIG, planSpeedNetworkingRound, selectSpeedNetworkingTier, type SpeedNetworkingCandidate } from "@/services/speed-networking/speedNetworkingTiers";
import { SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";

const NOW = Date.parse("2026-09-16T20:00:00.000Z");
const ROUNDS = 12;

function attendeeId(index: number) {
  return `att-${String(index).padStart(2, "0")}`;
}

/** A fixed source so a round replays identically; the real matcher passes Math.random. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function spread(totals: number[]) {
  return Math.max(...totals) - Math.min(...totals);
}

describe("speed networking fairness when everybody joined at the same moment", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-fair-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    // The weighted-random tier reaches for Math.random, so the whole simulation is seeded.
    vi.spyOn(Math, "random").mockImplementation(seededRandom(20260916));
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); vi.useRealTimers(); vi.restoreAllMocks(); });

  /**
   * One simulation run: N people press Join inside a single tick, then M rounds of the real
   * matcher with the clock advanced a match-length between them. Everyone asks to meet somebody
   * again each round — N people are only N(N-1)/2 pairs, so without that the queue runs out of new
   * faces within about N rounds and stops being a test of who gets a seat.
   */
  async function playRotation(eventId: string, people: number, rounds: number) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const attendees = Array.from({ length: people }, (_, index) => ({ attendeeId: attendeeId(index), displayName: `Attendee ${index}`, company: `Company ${index}` }));
    for (const who of attendees) await joinNetworkingQueue(eventId, who);
    const store = getRuntimeStore();
    const joinTimes = new Set((await store.listSpeedNetworkingEntries(eventId)).map((entry) => entry.joinedAt));
    expect(joinTimes.size, "the fixture is meant to be one simultaneous join").toBe(1);

    const sitOutsByRound: string[][] = [];
    for (let round = 0; round < rounds; round += 1) {
      for (const who of attendees) await allowRepeatNetworkingMatch(eventId, who.attendeeId);
      await runNetworkingMatcher(eventId);
      const waiting = (await store.listSpeedNetworkingEntries(eventId)).filter((entry) => entry.status === "waiting");
      sitOutsByRound.push(waiting.map((entry) => entry.attendeeId));
      vi.advanceTimersByTime(SPEED_NETWORKING_DEFAULT_MINUTES * 60_000 + 30_000);
    }
    const totals = attendees.map((who) => sitOutsByRound.filter((round) => round.includes(who.attendeeId)).length);
    return { sitOutsByRound, totals };
  }

  /**
   * 3, 5, 7 and 9 are the FIFO tier; 12 and 13 are weighted random (12 is the even case, where a
   * fair round leaves nobody out at all, and 13 is where the pre-fix rotation failed); 51 is the
   * scored tier, where affinity chooses partners and must not be allowed to choose who is seated.
   */
  /**
   * The budget has to match what the simulation actually costs, not a round number. A 51-person
   * room plays every round through the scored matcher and takes about 40 seconds on a developer
   * machine, so a flat 20 seconds made the clock, rather than the rotation, the thing that failed
   * — intermittently, and on origin/main as well as on a branch (reproduced 17 Sep 2026). The
   * assertions below are untouched; only the stopwatch is honest now.
   */
  const budgetFor = (people: number) => Math.max(20_000, people * 2_500);

  for (const people of [3, 5, 7, 9, 12, 13, 51]) {
    it(`spreads the sit-outs to within one over ${ROUNDS} rounds with ${people} waiting (${selectSpeedNetworkingTier(people)} tier)`, async () => {
      const { sitOutsByRound, totals } = await playRotation(`fair-spread-${people}`, people, ROUNDS);
      expect(sitOutsByRound).toHaveLength(ROUNDS);
      // An even room seats everybody; an odd one seats all but one, never two.
      for (const round of sitOutsByRound) expect(round).toHaveLength(people % 2);
      expect(spread(totals), `sit-outs were not level: ${JSON.stringify(totals)}`).toBeLessThanOrEqual(1);
      // And the arithmetic adds up — the rounds really did run and really did leave somebody out.
      expect(totals.reduce((sum, count) => sum + count, 0)).toBe(ROUNDS * (people % 2));
    }, budgetFor(people));

    it(`never sits the same person out twice running with ${people} waiting`, async () => {
      const { sitOutsByRound } = await playRotation(`fair-consecutive-${people}`, people, ROUNDS);
      for (let index = 1; index < sitOutsByRound.length; index += 1) {
        for (const id of sitOutsByRound[index]) {
          expect(sitOutsByRound[index - 1], `${id} sat out rounds ${index - 1} and ${index}`).not.toContain(id);
        }
      }
    }, budgetFor(people));
  }

  /**
   * The "you are next" signal has to be true, not encouraging. Whoever the round left out is told
   * they are next, and the next round has to seat them.
   */
  it("tells the people a round left out that they are next, and the next round seats them", async () => {
    const eventId = "fair-next-up";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const attendees = Array.from({ length: 7 }, (_, index) => ({ attendeeId: attendeeId(index), displayName: `Attendee ${index}`, company: `Company ${index}` }));
    for (const who of attendees) await joinNetworkingQueue(eventId, who);
    const store = getRuntimeStore();
    let toldTheyAreNext: string[] = [];
    for (let round = 0; round < 6; round += 1) {
      for (const who of attendees) await allowRepeatNetworkingMatch(eventId, who.attendeeId);
      await runNetworkingMatcher(eventId);
      const waiting = (await store.listSpeedNetworkingEntries(eventId)).filter((entry) => entry.status === "waiting").map((entry) => entry.attendeeId);
      // Whoever was told they were next last round is in a match this round rather than waiting again.
      for (const id of toldTheyAreNext) expect(waiting, `${id} was told they were next and then left out again`).not.toContain(id);
      const state = await getNetworkingRoundState(eventId);
      expect([...state.priorityAttendeeIds].sort()).toEqual([...waiting].sort());
      // And it is what the attendee is actually shown, not just what the round state holds.
      for (const id of waiting) expect((await getMyNetworkingState(eventId, id)).nextUp).toBe(true);
      toldTheyAreNext = waiting;
      vi.advanceTimersByTime(SPEED_NETWORKING_DEFAULT_MINUTES * 60_000 + 30_000);
    }
  }, 20_000);

  /**
   * The matcher runs on every read, and a read is not a round. Somebody waiting alone while the
   * rest of the room is mid-match must not owe more sit-outs the more often their phone polls.
   */
  it("does not charge a sit-out for a poll that seated nobody", async () => {
    const eventId = "fair-polling";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    for (let index = 0; index < 3; index += 1) await joinNetworkingQueue(eventId, { attendeeId: attendeeId(index), displayName: `Attendee ${index}`, company: `Company ${index}` });
    await runNetworkingMatcher(eventId);
    const afterTheRound = await getNetworkingRoundState(eventId);
    const leftOut = afterTheRound.priorityAttendeeIds[0];
    expect(leftOut).toBeDefined();
    expect(afterTheRound.satOutCounts[leftOut]).toBe(1);
    for (let poll = 0; poll < 5; poll += 1) await getMyNetworkingState(eventId, leftOut);
    expect((await getNetworkingRoundState(eventId)).satOutCounts[leftOut], "polling inflated the sit-out debt").toBe(1);
  });

  /** The debt has to outlive being matched, or it is only ever a record of the last round. */
  it("carries the sit-out debt through a match rather than clearing it", async () => {
    const eventId = "fair-carry";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    for (let index = 0; index < 3; index += 1) await joinNetworkingQueue(eventId, { attendeeId: attendeeId(index), displayName: `Attendee ${index}`, company: `Company ${index}` });
    await runNetworkingMatcher(eventId);
    const leftOut = (await getNetworkingRoundState(eventId)).priorityAttendeeIds[0];
    vi.advanceTimersByTime(SPEED_NETWORKING_DEFAULT_MINUTES * 60_000 + 30_000);
    await runNetworkingMatcher(eventId);
    const second = await getNetworkingRoundState(eventId);
    // They were matched this round — and still owed one, which is what keeps the rotation moving.
    expect(second.priorityAttendeeIds).not.toContain(leftOut);
    expect(second.satOutCounts[leftOut], "the debt was cleared on being matched").toBe(1);
  });
});

/**
 * The parts of the rule that are cheaper to state against the pure planner than to arrange in a
 * store: a large room where affinity would rather seat somebody else, and the tie-break itself.
 */
describe("the sit-out debt is a floor at every tier, not a scoring nicety", () => {
  const EVENT = "floor-event";
  const JOINED_TOGETHER = new Date(NOW - 60_000).toISOString();

  function simultaneousQueue(people: number): SpeedNetworkingCandidate[] {
    return Array.from({ length: people }, (_, index) => ({
      attendeeId: attendeeId(index),
      displayName: `Attendee ${index}`,
      // Distinct companies so the same-company rule never decides the round for us.
      company: `Company ${index}`,
      joinedAt: JOINED_TOGETHER,
    }));
  }

  it("seats the most-owed attendee in the scored tier, whatever the affinity says", () => {
    const queue = simultaneousQueue(51).map((candidate, index) => ({
      ...candidate,
      // Everybody in the room is a strong affinity match for everybody else — except the one
      // person the room already owes three sit-outs to, who shares nothing with anyone. Scored
      // greedily on affinity alone, their pairs come dead last and they are the one left over.
      topicsOfInterest: index === 50 ? ["yak shaving"] : ["ai", "ml", "data"],
      networkingGoals: index === 50 ? "" : index % 2 === 0 ? "hiring for my team" : "looking for a new role",
      timesSatOut: index === 50 ? 3 : 0,
    }));
    const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting: queue, pairHistory: [], nowMs: NOW, random: seededRandom(11) });
    expect(plan.tier).toBe("scored");
    const owed = attendeeId(50);
    expect(plan.pairs.some((pair) => pair.first.attendeeId === owed || pair.second.attendeeId === owed)).toBe(true);
    expect(plan.oddOneOut?.attendeeId).not.toBe(owed);
    // Affinity was re-ordered behind the debt, never overruled: every other pair in the round is
    // still a shared-topic pair rather than a random one.
    const affinityPairs = plan.pairs.filter((pair) => pair.first.attendeeId !== owed && pair.second.attendeeId !== owed);
    expect(affinityPairs).toHaveLength(plan.pairs.length - 1);
    for (const pair of affinityPairs) expect(pair.score).toBeGreaterThanOrEqual(SPEED_NETWORKING_MATCHING_CONFIG.score.perSharedTopic * SPEED_NETWORKING_MATCHING_CONFIG.score.maxScoredTopics);
  });

  it("seats the most-owed attendee in the weighted-random tier, whatever the draw says", () => {
    const queue = simultaneousQueue(13).map((candidate, index) => ({ ...candidate, timesSatOut: index === 12 ? 3 : 0 }));
    // Every draw, not one lucky one: the owed attendee is seated whatever the random source does.
    for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
      const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting: queue, pairHistory: [], nowMs: NOW, random: () => value });
      expect(plan.tier).toBe("weighted_random");
      expect(plan.oddOneOut?.attendeeId, `draw ${value} left the most-owed attendee out`).not.toBe(attendeeId(12));
    }
  });

  it("holds back the least-owed attendee, so an identical joinedAt never decides who sits out", () => {
    // Nine people, identical join times, and one of them already owes nothing while the rest owe one.
    const queue = simultaneousQueue(9).map((candidate, index) => ({ ...candidate, timesSatOut: index === 3 ? 0 : 1 }));
    const plan = planSpeedNetworkingRound({ eventId: EVENT, waiting: queue, pairHistory: [], nowMs: NOW, random: seededRandom(5) });
    expect(plan.oddOneOut?.attendeeId).toBe(attendeeId(3));
    // And sitting out LAST round beats any amount of older debt: the promise not to sit somebody
    // out twice running is the harder one.
    const withPriority = queue.map((candidate, index) => (index === 3 ? { ...candidate, priority: true } : { ...candidate, timesSatOut: 5 }));
    const next = planSpeedNetworkingRound({ eventId: EVENT, waiting: withPriority, pairHistory: [], nowMs: NOW, random: seededRandom(5) });
    expect(next.oddOneOut?.attendeeId).not.toBe(attendeeId(3));
  });
});
