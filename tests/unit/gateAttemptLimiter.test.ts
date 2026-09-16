import { beforeEach, describe, expect, it } from "vitest";
import { ATTEMPT_LIMIT, checkGateAttempts, clearGateAttempts, gateAttemptKeyFor, recordGateFailure, resetGateAttemptsForTests } from "@/services/access/gateAttemptLimiter";

/**
 * Readable codes (WPL-CREW-45MINU) are guessable from a public event name on purpose, so the gate
 * is where that is paid for: a few wrong codes from one place, then a short cooldown. A guest who
 * mistypes twice must never feel it, and a right code clears the record.
 */
describe("gate attempt limiter", () => {
  beforeEach(() => resetGateAttemptsForTests());
  const key = gateAttemptKeyFor({ ip: "203.0.113.5", eventCode: "WPL-45MINU", gate: "crew" });

  it("lets an honest mistype through", () => {
    recordGateFailure(key);
    recordGateFailure(key);
    expect(checkGateAttempts(key).allowed).toBe(true);
  });

  it("cools down after the limit, and says for how long", () => {
    let cooling = false;
    for (let attempt = 0; attempt < ATTEMPT_LIMIT; attempt += 1) cooling = recordGateFailure(key).cooling;
    expect(cooling).toBe(true);
    const gate = checkGateAttempts(key);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.retryInSeconds).toBeGreaterThan(30);
  });

  it("the cooldown ends by itself", () => {
    for (let attempt = 0; attempt < ATTEMPT_LIMIT; attempt += 1) recordGateFailure(key);
    expect(checkGateAttempts(key, Date.now() + 130_000).allowed).toBe(true);
  });

  it("a right code clears the record", () => {
    for (let attempt = 0; attempt < ATTEMPT_LIMIT; attempt += 1) recordGateFailure(key);
    clearGateAttempts(key);
    expect(checkGateAttempts(key).allowed).toBe(true);
  });

  it("one prober does not lock out a different event or a different place", () => {
    for (let attempt = 0; attempt < ATTEMPT_LIMIT; attempt += 1) recordGateFailure(key);
    expect(checkGateAttempts(gateAttemptKeyFor({ ip: "203.0.113.5", eventCode: "WPL-OTHER", gate: "crew" })).allowed).toBe(true);
    expect(checkGateAttempts(gateAttemptKeyFor({ ip: "198.51.100.9", eventCode: "WPL-45MINU", gate: "crew" })).allowed).toBe(true);
    expect(checkGateAttempts(gateAttemptKeyFor({ ip: "203.0.113.5", eventCode: "WPL-45MINU", gate: "special_guest" })).allowed).toBe(true);
  });
});
