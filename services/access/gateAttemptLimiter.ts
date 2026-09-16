import { sha256Hex } from "@/lib/security/portableCrypto";

/**
 * Codes are readable by design (WPL-CREW-45MINU), so the protection lives at the gate: a handful of
 * wrong codes from one place, then a short cooldown. The numbers are chosen so a guest who mistypes
 * twice never notices, and someone walking the alphabet gets nowhere.
 *
 * In-memory per isolate: a Worker isolate handles many requests, so this catches the ordinary case
 * (one prober, one isolate) without a round trip to the database on every gate submission.
 */
export const ATTEMPT_LIMIT = 6;
export const ATTEMPT_WINDOW_MS = 60_000;
export const COOLDOWN_MS = 120_000;

interface Bucket {
  failures: number[];
  cooldownUntil?: number;
}

const buckets = new Map<string, Bucket>();

export function gateAttemptKeyFor(input: { ip?: string; eventCode?: string; gate: string }) {
  return `${input.gate}:${(input.eventCode || "-").toLowerCase()}:${input.ip || "unknown"}`;
}

export function checkGateAttempts(key: string, now = Date.now()): { allowed: true } | { allowed: false; retryInSeconds: number } {
  const bucket = buckets.get(key);
  if (!bucket) return { allowed: true };
  if (bucket.cooldownUntil && bucket.cooldownUntil > now) return { allowed: false, retryInSeconds: Math.ceil((bucket.cooldownUntil - now) / 1000) };
  return { allowed: true };
}

/** Records one wrong code. Returns whether that tripped the cooldown. */
export function recordGateFailure(key: string, now = Date.now()) {
  const bucket = buckets.get(key) || { failures: [] };
  bucket.failures = bucket.failures.filter((at) => now - at < ATTEMPT_WINDOW_MS);
  bucket.failures.push(now);
  if (bucket.failures.length >= ATTEMPT_LIMIT) {
    bucket.cooldownUntil = now + COOLDOWN_MS;
    bucket.failures = [];
    buckets.set(key, bucket);
    return { cooling: true, retryInSeconds: Math.ceil(COOLDOWN_MS / 1000) };
  }
  buckets.set(key, bucket);
  return { cooling: false, retryInSeconds: 0 };
}

/** A right code clears the record: a guest who finally got it in is not on a naughty list. */
export function clearGateAttempts(key: string) {
  buckets.delete(key);
}

export function resetGateAttemptsForTests() {
  buckets.clear();
}

/** The caller's rough origin, hashed before it is ever stored. Never the value they typed. */
export async function requestIpHash(request: { headers: Headers }) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  return ip ? { ip, ipHash: await sha256Hex(ip) } : { ip: undefined, ipHash: undefined };
}
