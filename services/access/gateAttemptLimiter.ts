import { getGateRateLimiter, getWideGateRateLimiter, type RateLimitBindingLike } from "@/lib/d1/binding";
import { sha256Hex } from "@/lib/security/portableCrypto";

/**
 * Every door that takes a secret counts its tries here: a handful a minute from one place, then a
 * wait. A guest who mistypes twice never notices; someone walking the alphabet gets nowhere.
 *
 * Two counts per attempt, and both must allow it:
 * - narrow, GATE_LIMITER: gate + scope + address. The scope is what the attempt is ABOUT, as the
 *   server resolved it (an event's id, `unknown-event`, an email's hash), never the text typed: a
 *   typed code can be varied endlessly ("WPL-ABC", "wpl abc ", "x1", "x2"…) for a fresh bucket each.
 * - wide, GATE_LIMITER_WIDE: gate + address across every scope, so walking from event to event
 *   does not reset the count either.
 * The address is the IPv4 address, or the IPv6 /64: one subscriber holds a whole /64.
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
export const GATE_WIDE_ATTEMPTS_PER_WINDOW = 20; // must match ratelimits[GATE_LIMITER_WIDE].simple.limit (period 60)
/** The scope for an attempt whose event the server could not resolve: all such attempts share one count. */
export const UNKNOWN_EVENT_SCOPE = "unknown-event";

export type GateName = "owner" | "operator" | "crew" | "special_guest" | "attendee_return" | "vip_redeem" | "login";

/**
 * When the limiter itself is down. The production doors (owner opens every event, operator and crew
 * run the show) refuse rather than go unguarded. The guest doors (a speaker's code, an attendee's
 * second device, a VIP code in the lobby) let the attempt through and log it: they open one event's
 * guest view, and a broken safety check must not keep every speaker out of a show that is already
 * running. In an outage the owner password still opens every door, logged (ownerAtEveryDoor).
 * The account login holds every event of an agency, so it refuses.
 */
const FAIL_CLOSED: Record<GateName, boolean> = {
  owner: true,
  operator: true,
  crew: true,
  special_guest: false,
  attendee_return: false,
  vip_redeem: false,
  login: true,
};

export type GateAttempt =
  | { allowed: true; degraded?: true }
  | { allowed: false; reason: "too_many"; retryInSeconds: number }
  | { allowed: false; reason: "limiter_unavailable" };

/**
 * The address part of a key: IPv4 as is; IPv6 cut to its /64 (an IPv4-mapped IPv6 address is its
 * IPv4 address). Anything unparseable is kept whole rather than dropped.
 */
export function ipRateKey(ip: string | undefined) {
  const address = (ip || "").trim().toLowerCase();
  if (!address) return "unknown";
  if (!address.includes(":")) return address;
  const mapped = address.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/) || address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const bare = address.replace(/%.*$/, "").replace(/^\[|\]$/g, "");
  const [head, tail = ""] = bare.split("::");
  const left = head ? head.split(":") : [];
  const right = bare.includes("::") && tail ? tail.split(":") : [];
  if (right.some((part) => part.includes(".")) || left.some((part) => part.includes("."))) return bare;
  const groups = bare.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return bare;
  return `${groups.slice(0, 4).map((part) => part.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

export function gateAttemptKeyFor(input: { ip?: string; scope?: string; gate: GateName }) {
  return `${input.gate}:${(input.scope || "-").toLowerCase()}:${ipRateKey(input.ip)}`;
}

export function wideGateAttemptKeyFor(input: { ip?: string; gate: GateName }) {
  return `${input.gate}:*:${ipRateKey(input.ip)}`;
}

/**
 * Counts one attempt at a gate and says whether it may go ahead. Call before the secret is checked.
 * `scope` is the server's own reading of what is being opened (a resolved event id, UNKNOWN_EVENT_SCOPE,
 * an email hash), never raw form text.
 */
export async function takeGateAttempt(input: { ip?: string; scope?: string; gate: GateName }): Promise<GateAttempt> {
  const narrow = testLimiter ?? getGateRateLimiter();
  const wide = testWideLimiter ?? getWideGateRateLimiter();
  const narrowBinding = narrow.inWorker ? narrow.binding : localStandIn;
  const wideBinding = wide.inWorker ? wide.binding : localWideStandIn;
  try {
    if (!narrowBinding) throw new Error("GATE_LIMITER is not bound on this deployment (ratelimits in wrangler.jsonc).");
    if (!wideBinding) throw new Error("GATE_LIMITER_WIDE is not bound on this deployment (ratelimits in wrangler.jsonc).");
    // Both are counted every time, so a refusal by one still spends a try on the other.
    const [one, all] = await Promise.all([narrowBinding.limit({ key: gateAttemptKeyFor(input) }), wideBinding.limit({ key: wideGateAttemptKeyFor(input) })]);
    return one.success && all.success ? { allowed: true } : { allowed: false, reason: "too_many", retryInSeconds: GATE_WINDOW_SECONDS };
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
let localWideStandIn = createInProcessRateLimiter(GATE_WIDE_ATTEMPTS_PER_WINDOW);
let testLimiter: { inWorker: boolean; binding?: RateLimitBindingLike } | undefined;
let testWideLimiter: { inWorker: boolean; binding?: RateLimitBindingLike } | undefined;

/**
 * Tests: `binding` stands for GATE_LIMITER and `wide` for GATE_LIMITER_WIDE (by default a fresh
 * counter with the wide limit when `binding` is given). `undefined` means "in a Worker, not bound".
 */
export function setGateLimiterForTests(binding: RateLimitBindingLike | undefined | "unset", wide?: RateLimitBindingLike) {
  if (binding === "unset") { testLimiter = undefined; testWideLimiter = undefined; return; }
  testLimiter = { inWorker: true, binding };
  testWideLimiter = { inWorker: true, binding: wide ?? (binding ? createInProcessRateLimiter(GATE_WIDE_ATTEMPTS_PER_WINDOW) : undefined) };
}

export function resetGateAttemptsForTests() {
  localStandIn = createInProcessRateLimiter();
  localWideStandIn = createInProcessRateLimiter(GATE_WIDE_ATTEMPTS_PER_WINDOW);
  testLimiter = undefined;
  testWideLimiter = undefined;
}

/** The caller's rough origin, hashed before it is ever stored. Never the value they typed. */
export async function requestIpHash(request: { headers: Pick<Headers, "get"> }) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  return ip ? { ip, ipHash: await sha256Hex(ip) } : { ip: undefined, ipHash: undefined };
}
