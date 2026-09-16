import { selectNextSpeedNetworkingPair } from "@/services/speed-networking/speedNetworkingEngine";
import type { SpeedNetworkingEntry, SpeedNetworkingPairHistory } from "@/types/speedNetworkingEngine";

/**
 * Tiered matching (16 Sep 2026). Longest-waiting-first is the right answer for a small room and
 * the wrong one for a big one, so the matcher picks its method from how many people are actually
 * waiting: fairness when there are few, spread when there are some, affinity when there are many.
 * Everything is pure and deterministic given a queue and a random source, so a round can be
 * replayed in a test; the thresholds and weights are all in SPEED_NETWORKING_MATCHING_CONFIG so
 * they can be tuned in one place rather than hunted through the code.
 */

export type SpeedNetworkingTier = "fifo" | "weighted_random" | "scored";

export const SPEED_NETWORKING_MATCHING_CONFIG = {
  tiers: {
    /** Below this many waiting, fairness IS the algorithm: longest-waiting first. */
    fifoBelowWaiting: 12,
    /** Up to this many, weighted random inside the longest-waiting half so the same two stop cycling back. */
    weightedRandomThroughWaiting: 50,
    /** Above that, score the pairs. */
  },
  weightedRandom: {
    /** Only the longest-waiting share of the queue is eligible as a partner, so nobody is skipped forever. */
    poolFraction: 0.5,
    minimumPoolSize: 4,
    /** A partner's draw weight is 1 + this per minute they have already waited. */
    waitMinuteWeight: 0.5,
  },
  score: {
    /** Shared topics of interest are the strongest affinity signal. */
    perSharedTopic: 10,
    maxScoredTopics: 3,
    /** Two goals that want opposite sides of the same conversation (hiring ↔ job hunting). */
    complementaryGoal: 6,
    /** Same goal, same conversation — worth something, worth less. */
    sharedGoal: 3,
    /**
     * Wait time, weighted so it grows past everything else: affinity tops out at
     * perSharedTopic * maxScoredTopics + complementaryGoal = 36, so nine minutes of waiting beats
     * the best possible affinity and nobody starves for a perfect partner.
     */
    perWaitingMinute: 4,
  },
  /** Never two people from the same organisation — they can talk at their own desks. */
  blockSameCompany: true,
} as const;

/**
 * Free-text networking goals, read as intent. Two people are complementary when one wants what
 * the other has; the table is small and named on purpose — it is a product decision, not a model.
 */
const GOAL_INTENTS: Array<{ intent: string; patterns: RegExp }> = [
  { intent: "hiring", patterns: /\b(hiring|recruit|recruiting|headcount|open roles?|build(ing)? (a|my|our) team)\b/i },
  { intent: "job_seeking", patterns: /\b(job|new role|looking for work|opportunit(y|ies)|career change|get hired)\b/i },
  { intent: "selling", patterns: /\b(sell|selling|customers?|clients?|pipeline|leads?|business development|bd)\b/i },
  { intent: "buying", patterns: /\b(buy|buying|vendors?|suppliers?|procure|procurement|evaluating tools?)\b/i },
  { intent: "fundraising", patterns: /\b(fundrais|raising|seed|series [a-c]|capital|runway)\b/i },
  { intent: "investing", patterns: /\b(invest|investor|lp\b|angel|portfolio|deal ?flow)\b/i },
  { intent: "mentoring", patterns: /\b(mentor|advise|advising|coach|giving back|share what)\b/i },
  { intent: "learning", patterns: /\b(learn|learning|advice|guidance|mentorship|figure out how)\b/i },
  { intent: "partnership", patterns: /\b(partner|partnership|collaborat|co-?market|integrat)\b/i },
];

const COMPLEMENTARY_INTENTS: Array<[string, string]> = [
  ["hiring", "job_seeking"],
  ["selling", "buying"],
  ["fundraising", "investing"],
  ["mentoring", "learning"],
];

export function readGoalIntents(goals: string | undefined) {
  if (!goals) return [] as string[];
  return GOAL_INTENTS.filter((entry) => entry.patterns.test(goals)).map((entry) => entry.intent);
}

export interface SpeedNetworkingCandidate {
  attendeeId: string;
  displayName: string;
  company?: string;
  title?: string;
  topicsOfInterest?: string[];
  networkingGoals?: string;
  /** ISO. The queue clock: reset whenever they return to waiting. */
  joinedAt: string;
  /** Left over from the last round, or told "you are next": they lead the queue this round. */
  priority?: boolean;
}

export function selectSpeedNetworkingTier(waitingCount: number): SpeedNetworkingTier {
  if (waitingCount < SPEED_NETWORKING_MATCHING_CONFIG.tiers.fifoBelowWaiting) return "fifo";
  if (waitingCount <= SPEED_NETWORKING_MATCHING_CONFIG.tiers.weightedRandomThroughWaiting) return "weighted_random";
  return "scored";
}

function normalizeCompany(company: string | undefined) {
  return (company || "").trim().toLowerCase().replace(/[.,]|\b(inc|llc|ltd|limited|corp|corporation|co)\b/g, "").replace(/\s+/g, " ").trim();
}

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase();
}

export function waitedMinutes(candidate: SpeedNetworkingCandidate, nowMs: number) {
  return Math.max(0, (nowMs - new Date(candidate.joinedAt).getTime()) / 60_000);
}

export function pairKey(eventId: string, firstId: string, secondId: string) {
  return `${eventId}::${[firstId, secondId].sort().join("::")}`;
}

export interface SpeedNetworkingPairScore {
  score: number;
  sharedTopics: string[];
  complementary: boolean;
  sameCompany: boolean;
}

/** Pure: what a pairing is worth. A same-company pair scores nothing and is never returned as a pair. */
export function scoreSpeedNetworkingPair(first: SpeedNetworkingCandidate, second: SpeedNetworkingCandidate, nowMs: number): SpeedNetworkingPairScore {
  const config = SPEED_NETWORKING_MATCHING_CONFIG.score;
  const firstCompany = normalizeCompany(first.company);
  const sameCompany = Boolean(firstCompany) && firstCompany === normalizeCompany(second.company);
  const secondTopics = new Set((second.topicsOfInterest || []).map(normalizeTopic));
  const sharedTopics = Array.from(new Set((first.topicsOfInterest || []).map(normalizeTopic))).filter((topic) => topic && secondTopics.has(topic));
  const firstIntents = readGoalIntents(first.networkingGoals);
  const secondIntents = readGoalIntents(second.networkingGoals);
  const complementary = COMPLEMENTARY_INTENTS.some(([left, right]) => (firstIntents.includes(left) && secondIntents.includes(right)) || (firstIntents.includes(right) && secondIntents.includes(left)));
  const sharedGoal = !complementary && firstIntents.some((intent) => secondIntents.includes(intent));
  const affinity =
    Math.min(sharedTopics.length, config.maxScoredTopics) * config.perSharedTopic +
    (complementary ? config.complementaryGoal : sharedGoal ? config.sharedGoal : 0);
  // The longer of the two waits drives the pair: pairing a long waiter clears the worst wait.
  const wait = Math.max(waitedMinutes(first, nowMs), waitedMinutes(second, nowMs)) * config.perWaitingMinute;
  return { score: sameCompany ? 0 : affinity + wait, sharedTopics, complementary, sameCompany };
}

export interface SpeedNetworkingRoundPlan {
  tier: SpeedNetworkingTier;
  pairs: Array<{ first: SpeedNetworkingCandidate; second: SpeedNetworkingCandidate; score: number }>;
  /** Waiting, unpaired, and longest-waiting of those left: told "you are next" and led in next round. */
  oddOneOut?: SpeedNetworkingCandidate;
  /** Still waiting for an ordinary reason — the round simply ran out of partners for them. */
  unmatched: SpeedNetworkingCandidate[];
  /** Has met, or cannot be paired with, everyone else here: the queue cannot resolve for them. */
  metEveryone: SpeedNetworkingCandidate[];
}

function queueOrder(a: SpeedNetworkingCandidate, b: SpeedNetworkingCandidate) {
  if (Boolean(a.priority) !== Boolean(b.priority)) return a.priority ? -1 : 1;
  return a.joinedAt.localeCompare(b.joinedAt);
}

/**
 * One batch tick. Pairs are formed for the whole queue at once rather than as people arrive, so
 * whoever happens to poll first does not take the best partner; given the same queue, the same
 * history and the same random source, the round is identical every time.
 */
export function planSpeedNetworkingRound(input: {
  eventId: string;
  waiting: SpeedNetworkingCandidate[];
  pairHistory: SpeedNetworkingPairHistory[];
  /** Attendees who asked to meet someone again once they had met everyone. */
  repeatOptIn?: string[];
  nowMs?: number;
  /** Injected so a round can be replayed exactly; defaults to Math.random. */
  random?: () => number;
}): SpeedNetworkingRoundPlan {
  const nowMs = input.nowMs ?? Date.now();
  const random = input.random ?? Math.random;
  const repeatOptIn = new Set(input.repeatOptIn || []);
  const history = input.pairHistory.filter((item) => item.eventId === input.eventId);
  const met = new Set(history.map((item) => item.normalizedPairKey));
  const tier = selectSpeedNetworkingTier(input.waiting.length);

  const compatible = (first: SpeedNetworkingCandidate, second: SpeedNetworkingCandidate) => {
    if (first.attendeeId === second.attendeeId) return false;
    if (SPEED_NETWORKING_MATCHING_CONFIG.blockSameCompany && scoreSpeedNetworkingPair(first, second, nowMs).sameCompany) return false;
    if (!met.has(pairKey(input.eventId, first.attendeeId, second.attendeeId))) return true;
    // A repeat is allowed only when BOTH have said they would rather meet someone again than wait.
    return repeatOptIn.has(first.attendeeId) && repeatOptIn.has(second.attendeeId);
  };

  const queue = [...input.waiting].sort(queueOrder);
  const metEveryone = queue.filter((candidate) => !queue.some((other) => compatible(candidate, other)) && queue.length > 1);
  const taken = new Set<string>();
  const pairs: SpeedNetworkingRoundPlan["pairs"] = [];

  if (tier === "scored") {
    // Every allowed pair, best first; greedy over that list is a stable, explainable matching.
    const scored: Array<{ first: SpeedNetworkingCandidate; second: SpeedNetworkingCandidate; score: number }> = [];
    for (let i = 0; i < queue.length; i += 1) {
      for (let j = i + 1; j < queue.length; j += 1) {
        if (!compatible(queue[i], queue[j])) continue;
        scored.push({ first: queue[i], second: queue[j], score: scoreSpeedNetworkingPair(queue[i], queue[j], nowMs).score });
      }
    }
    scored.sort((a, b) => b.score - a.score || queueOrder(a.first, b.first) || a.second.attendeeId.localeCompare(b.second.attendeeId));
    for (const option of scored) {
      if (taken.has(option.first.attendeeId) || taken.has(option.second.attendeeId)) continue;
      taken.add(option.first.attendeeId);
      taken.add(option.second.attendeeId);
      pairs.push(option);
    }
  } else if (tier === "fifo") {
    // Small room: fairness is the algorithm. The existing pure engine does exactly this — two
    // longest-waiting compatible people, no repeats — and same-company pairs are handed to it as
    // pairs that have already met, which is the one extra rule it does not know about.
    const byId = new Map(queue.map((candidate) => [candidate.attendeeId, candidate]));
    const blocked: Array<[string, string]> = [];
    for (let i = 0; i < queue.length; i += 1) {
      for (let j = i + 1; j < queue.length; j += 1) {
        if (!compatible(queue[i], queue[j])) blocked.push([queue[i].attendeeId, queue[j].attendeeId]);
      }
    }
    const entries: SpeedNetworkingEntry[] = queue.map((candidate) => ({
      id: candidate.attendeeId,
      agencyId: "west-peek",
      eventId: input.eventId,
      queueId: `${input.eventId}-queue`,
      attendeeId: candidate.attendeeId,
      displayName: candidate.displayName,
      status: "waiting",
      // The engine orders purely by queue time, so "you are next" is expressed the only way it
      // understands: whoever was left over last round sorts ahead of everyone, in their own order.
      joinedQueueAt: candidate.priority ? `0000-${candidate.joinedAt}` : candidate.joinedAt,
    }));
    const remaining = new Map(entries.map((entry) => [entry.attendeeId!, entry]));
    // A pair both of whom asked to meet someone again is taken back out of the history the engine reads.
    const historyForEngine = history.filter((item) => !(repeatOptIn.has(item.attendeeAId) && repeatOptIn.has(item.attendeeBId)));
    for (let guard = 0; guard < queue.length; guard += 1) {
      const pair = selectNextSpeedNetworkingPair(Array.from(remaining.values()), blocked, historyForEngine);
      if (!pair) break;
      const [first, second] = pair;
      remaining.delete(first.attendeeId!);
      remaining.delete(second.attendeeId!);
      const firstCandidate = byId.get(first.attendeeId!)!;
      const secondCandidate = byId.get(second.attendeeId!)!;
      taken.add(firstCandidate.attendeeId);
      taken.add(secondCandidate.attendeeId);
      pairs.push({ first: firstCandidate, second: secondCandidate, score: scoreSpeedNetworkingPair(firstCandidate, secondCandidate, nowMs).score });
    }
  } else {
    for (const seed of queue) {
      if (taken.has(seed.attendeeId)) continue;
      const options = queue.filter((other) => !taken.has(other.attendeeId) && compatible(seed, other));
      if (!options.length) continue;
      let partner = options[0];
      if (tier === "weighted_random") {
        const { poolFraction, minimumPoolSize, waitMinuteWeight } = SPEED_NETWORKING_MATCHING_CONFIG.weightedRandom;
        const poolSize = Math.max(minimumPoolSize, Math.ceil(options.length * poolFraction));
        const pool = options.slice(0, poolSize);
        const weights = pool.map((candidate) => 1 + waitedMinutes(candidate, nowMs) * waitMinuteWeight);
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        let ticket = random() * total;
        partner = pool[pool.length - 1];
        for (let index = 0; index < pool.length; index += 1) {
          ticket -= weights[index];
          if (ticket <= 0) { partner = pool[index]; break; }
        }
      }
      taken.add(seed.attendeeId);
      taken.add(partner.attendeeId);
      pairs.push({ first: seed, second: partner, score: scoreSpeedNetworkingPair(seed, partner, nowMs).score });
    }
  }

  const leftOver = queue.filter((candidate) => !taken.has(candidate.attendeeId));
  const metEveryoneIds = new Set(metEveryone.map((candidate) => candidate.attendeeId));
  // "Odd one out" is the one an odd-sized round could not seat — not somebody the queue can never serve.
  const oddOneOut = leftOver.find((candidate) => !metEveryoneIds.has(candidate.attendeeId));
  return { tier, pairs, oddOneOut, unmatched: leftOver, metEveryone };
}
