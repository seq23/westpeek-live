import { getGateRateLimiter, type RateLimitBindingLike } from "@/lib/d1/binding";
import { sha256Hex } from "@/lib/security/portableCrypto";

/**
 * Codes are readable by design (WPL-CREW-45MINU), so the protection lives at the gate: a handful of
 * tries a minute from one place, then a wait. A guest who mistypes twice never notices; someone
 * walking the alphabet gets nowhere.
 *
 * The count lives in the Cloudflare Rate Limiting binding `GATE_LIMITER` (wrangler.jsonc), not in
 * this isolate's memory: a prober's requests land on many isolates, and each one used to count on
 * its own from zero. Every attempt counts, right or wrong: the binding has no "peek", and a count
 * that only saw misses would let a right code through after the limit.
 *
 * Outside a Worker (`next dev`, `next start` for the e2e suite, unit tests) there is no binding and
 * exactly one process, so an in-process counter with the same contract stands in, as the file
 * store stands in for D1. Inside a Worker a missing or failing binding is an outage, handled per gate
 * by FAIL_CLOSED below.
 */
export const GATE_ATTEMPTS_PER_WINDOW = 6; // must match ratelimits[GATE_LIMITER].simple.limit in wrangler.jsonc
export const GATE_WINDOW_SECONDS = 60; // must match ratelimits[GATE_LIMITER].simple.period

export type GateName = "owner" | "operator" | "crew" | "special_guest" | "attendee_return";

/**
 * When the limiter itself is down. The production doors (owner opens every event, operator and crew
 * run the show) refuse rather than go unguarded. The guest doors (a speaker's code, an attendee's
 * second device) let the attempt through and log it: they open one event's guest view, and a broken
 * safety check must not keep every speaker out of a show that is already running.
 */
const FAIL_CLOSED: Record<GateName, boolean> = {
  owner: true,
  operator: true,
  crew: true,
  special_guest: false,
  attendee_return: false,
};

export type GateAttempt =
  | { allowed: true; degraded?: true }
  | { allowed: false; reason: "too_many"; retryInSeconds: number }
  | { allowed: false; reason: "limiter_unavailable" };

export function gateAttemptKeyFor(input: { ip?: string; eventCode?: string; gate: GateName }) {
  return `${input.gate}:${(input.eventCode || "-").toLowerCase()}:${input.ip || "unknown"}`;
}

/** Counts one attempt at a gate and says whether it may go ahead. Call before the code is checked. */
export async function takeGateAttempt(input: { ip?: string; eventCode?: string; gate: GateName }): Promise<GateAttempt> {
  const key = gateAttemptKeyFor(input);
  const limiter = testLimiter ?? getGateRateLimiter();
  const binding = limiter.inWorker ? limiter.binding : localStandIn;
  try {
    if (!binding) throw new Error("GATE_LIMITER is not bound on this deployment (ratelimits in wrangler.jsonc).");
    const { success } = await binding.limit({ key });
    return success ? { allowed: true } : { allowed: false, reason: "too_many", retryInSeconds: GATE_WINDOW_SECONDS };
  } catch (error) {
    console.error(`[gate-limiter] ${input.gate}: limiter unavailable, ${FAIL_CLOSED[input.gate] ? "refusing" : "letting through"}:`, error instanceof Error ? error.message : error);
    return FAIL_CLOSED[input.gate] ? { allowed: false, reason: "limiter_unavailable" } : { allowed: true, degraded: true };
  }
}

/** The redirect query for a refused attempt, read by each gate page. */
export function gateRefusalQuery(attempt: Exclude<GateAttempt, { allowed: true }>) {
  return attempt.reason === "too_many" ? `error=too_many&retry=${attempt.retryInSeconds}` : "error=paused";
}

/** A fixed window per key with the binding's contract, for a single process with no binding. */
export function createInProcessRateLimiter(limit = GATE_ATTEMPTS_PER_WINDOW, periodSeconds = GATE_WINDOW_SECONDS, now: () => number = Date.now): RateLimitBindingLike {
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    async limit({ key }) {
      const at = now();
      const window = windows.get(key);
      if (!window || at - window.startedAt >= periodSeconds * 1000) {
        windows.set(key, { startedAt: at, count: 1 });
        return { success: true };
      }
      window.count += 1;
      return { success: window.count <= limit };
    },
  };
}

let localStandIn = createInProcessRateLimiter();
let testLimiter: { inWorker: boolean; binding?: RateLimitBindingLike } | undefined;

/** Tests: `binding` stands for the Worker binding; `undefined` binding means "in a Worker, not bound". */
export function setGateLimiterForTests(binding: RateLimitBindingLike | undefined | "unset") {
  testLimiter = binding === "unset" ? undefined : { inWorker: true, binding };
}

export function resetGateAttemptsForTests() {
  localStandIn = createInProcessRateLimiter();
  testLimiter = undefined;
}

/** The caller's rough origin, hashed before it is ever stored. Never the value they typed. */
export async function requestIpHash(request: { headers: Headers }) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  return ip ? { ip, ipHash: await sha256Hex(ip) } : { ip: undefined, ipHash: undefined };
}
