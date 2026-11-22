import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { RateLimitBindingLike } from "@/lib/d1/binding";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { createInProcessRateLimiter, GATE_ATTEMPTS_PER_WINDOW, GATE_WIDE_ATTEMPTS_PER_WINDOW, GATE_WINDOW_SECONDS, ipRateKey, resetGateAttemptsForTests, setGateLimiterForTests, takeGateAttempt, UNKNOWN_EVENT_SCOPE } from "@/services/access/gateAttemptLimiter";
import { createEventRecord } from "@/services/events/eventRepository";

/**
 * Every door that takes a secret is limited: a few tries a minute from one place, then a wait. The count lives in the
 * Cloudflare Rate Limiting binding, shared by every isolate; these tests stand in for the binding
 * with one shared counter and load the limiter module fresh to play a new isolate.
 */
const OWNER_PASSWORD = "owner-test-master-2027";

/** One counter for "the Cloudflare location", as the binding is: every isolate sees the same one. */
function sharedBinding(limit = GATE_ATTEMPTS_PER_WINDOW): RateLimitBindingLike & { calls: string[] } {
  const inner = createInProcessRateLimiter(limit, GATE_WINDOW_SECONDS);
  const calls: string[] = [];
  return { calls, limit: async (options) => { calls.push(options.key); return inner.limit(options); } };
}

async function freshIsolate() {
  vi.resetModules();
  return import("@/services/access/gateAttemptLimiter");
}

function gatePost(gate: string, fields: Record<string, string>, ip = "203.0.113.5") {
  const body = new URLSearchParams(fields);
  return new NextRequest(`http://localhost/api/production-access/${gate}`, {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip },
  });
}

describe("gate attempt limiter", () => {
  let tempDir: string;
  beforeEach(() => {
    resetGateAttemptsForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-gate-"));
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    // A fresh isolate (vi.resetModules) builds its own store from these.
    vi.stubEnv("AGENCY_EVENT_OS_RUNTIME_STORE", "file");
    vi.stubEnv("AGENCY_EVENT_OS_RUNTIME_STORE_PATH", path.join(tempDir, "runtime.json"));
    vi.stubEnv("OWNER_MASTER_ACCESS_PASSWORD", OWNER_PASSWORD);
    vi.stubEnv("CREW_ACCESS_PASSWORD", "crew-test-password");
    vi.stubEnv("OPERATOR_LAUNCHPAD_PASSWORD", "operator-test-password");
    vi.stubEnv("V5_ACCESS_COOKIE_SECRET", "test-cookie-secret-test-cookie-secret");
  });
  afterEach(() => {
    resetGateAttemptsForTests();
    setRuntimeStoreForTests(undefined);
    vi.unstubAllEnvs();
    vi.spyOn(console, "error").mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("lets an honest mistype through", async () => {
    setGateLimiterForTests(sharedBinding());
    expect((await takeGateAttempt({ ip: "203.0.113.5", scope: "event-45minu", gate: "crew" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "203.0.113.5", scope: "event-45minu", gate: "crew" })).allowed).toBe(true);
  });

  it("holds the limit across isolates: a prober spread over fresh isolates is still refused", async () => {
    const binding = sharedBinding();
    for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW; attempt += 1) {
      const isolate = await freshIsolate();
      isolate.setGateLimiterForTests(binding);
      expect((await isolate.takeGateAttempt({ ip: "203.0.113.5", gate: "owner" })).allowed).toBe(true);
    }
    const next = await freshIsolate();
    next.setGateLimiterForTests(binding);
    const refused = await next.takeGateAttempt({ ip: "203.0.113.5", gate: "owner" });
    expect(refused).toEqual({ allowed: false, reason: "too_many", retryInSeconds: GATE_WINDOW_SECONDS });
  });

  it("brute force through the owner route: after six misses from one address, even the right password waits there (her own password still signs her in elsewhere)", async () => {
    const binding = sharedBinding();
    for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW; attempt += 1) {
      const isolate = await freshIsolate();
      isolate.setGateLimiterForTests(binding);
      const { POST } = await import("@/app/api/production-access/owner/route");
      const response = await POST(gatePost("owner", { password: `guess-${attempt}` }));
      expect(response.headers.get("location")).toContain("error=invalid");
    }
    const isolate = await freshIsolate();
    isolate.setGateLimiterForTests(binding);
    const { POST } = await import("@/app/api/production-access/owner/route");
    const guess = await POST(gatePost("owner", { password: "guess-after-limit" }));
    expect(guess.headers.get("location")).toContain("error=too_many");
    expect(guess.cookies.getAll()).toHaveLength(0);
    const locked = await POST(gatePost("owner", { password: OWNER_PASSWORD }));
    expect(locked.headers.get("location")).toContain("error=too_many");
    expect(locked.cookies.getAll()).toHaveLength(0);
    const elsewhere = await POST(gatePost("owner", { password: OWNER_PASSWORD }, "198.51.100.44"));
    expect(elsewhere.headers.get("location")).toContain("/app/owner");
    expect(elsewhere.cookies.getAll()).toHaveLength(1);
  });

  it("one prober does not lock out a different event, a different place or a different gate", async () => {
    setGateLimiterForTests(sharedBinding());
    for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW + 1; attempt += 1) await takeGateAttempt({ ip: "203.0.113.5", scope: "event-45minu", gate: "crew" });
    expect((await takeGateAttempt({ ip: "203.0.113.5", scope: "event-45minu", gate: "crew" })).allowed).toBe(false);
    expect((await takeGateAttempt({ ip: "203.0.113.5", scope: "event-other", gate: "crew" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "198.51.100.9", scope: "event-45minu", gate: "crew" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "203.0.113.5", scope: "event-45minu", gate: "special_guest" })).allowed).toBe(true);
  });

  it("the window ends by itself", async () => {
    let clock = 1_000_000;
    const binding = createInProcessRateLimiter(GATE_ATTEMPTS_PER_WINDOW, GATE_WINDOW_SECONDS, () => clock);
    setGateLimiterForTests(binding);
    for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW + 1; attempt += 1) await takeGateAttempt({ ip: "203.0.113.5", gate: "operator" });
    expect((await takeGateAttempt({ ip: "203.0.113.5", gate: "operator" })).allowed).toBe(false);
    clock += GATE_WINDOW_SECONDS * 1000;
    expect((await takeGateAttempt({ ip: "203.0.113.5", gate: "operator" })).allowed).toBe(true);
  });

  it("the limiter never sees what was typed: the key is the gate, the event and the address", async () => {
    const binding = sharedBinding();
    const wide = sharedBinding(GATE_WIDE_ATTEMPTS_PER_WINDOW);
    (await freshIsolate()).setGateLimiterForTests(binding, wide);
    const { POST } = await import("@/app/api/production-access/owner/route");
    await POST(gatePost("owner", { password: "a-secret-guess" }));
    expect(binding.calls).toEqual(["owner:-:203.0.113.5"]);
    expect(wide.calls).toEqual(["owner:*:203.0.113.5"]);
  });

  it("an IPv6 address counts by its /64; IPv4 and IPv4-mapped addresses as they are", () => {
    expect(ipRateKey("2001:db8:aa:bb:1:2:3:4")).toBe("2001:db8:aa:bb::/64");
    expect(ipRateKey("2001:0db8:00aa:00bb:ffff:ffff:ffff:ffff")).toBe("2001:db8:aa:bb::/64");
    expect(ipRateKey("2001:db8:aa::1")).toBe("2001:db8:aa:0::/64");
    expect(ipRateKey("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(ipRateKey("203.0.113.5")).toBe("203.0.113.5");
    expect(ipRateKey(undefined)).toBe("unknown");
  });

  it("a fresh IPv6 address per try from one /64 is still refused by the 7th", async () => {
    setGateLimiterForTests(sharedBinding());
    const results = [];
    for (let attempt = 1; attempt <= GATE_ATTEMPTS_PER_WINDOW + 1; attempt += 1) results.push((await takeGateAttempt({ ip: `2001:db8:aa:bb::${attempt.toString(16)}`, gate: "owner" })).allowed);
    expect(results.slice(0, GATE_ATTEMPTS_PER_WINDOW).every(Boolean)).toBe(true);
    expect(results[GATE_ATTEMPTS_PER_WINDOW]).toBe(false);
  });

  it("walking from event to event does not reset the count: the wide limit holds one address across all events", async () => {
    setGateLimiterForTests(sharedBinding());
    const allowed = [];
    for (let attempt = 0; attempt < GATE_WIDE_ATTEMPTS_PER_WINDOW + 1; attempt += 1) allowed.push((await takeGateAttempt({ ip: "203.0.113.5", scope: `event-${attempt}`, gate: "crew" })).allowed);
    expect(allowed.slice(0, GATE_WIDE_ATTEMPTS_PER_WINDOW).every(Boolean)).toBe(true);
    expect(allowed[GATE_WIDE_ATTEMPTS_PER_WINDOW]).toBe(false);
  });

  describe("lying client: the typed event code is varied or padded for a fresh count", () => {
    async function realEvent() {
      return createEventRecord({ name: `Limiter ${Date.now()}`, when: "now" }, { kind: "owner", id: "owner", label: "Owner", role: "owner" });
    }

    it("crew door: a new or padded event code each try is still refused by the 7th, and the right password then gets no cookie", async () => {
      (await freshIsolate()).setGateLimiterForTests(sharedBinding());
      const event = await realEvent();
      const { POST } = await import("@/app/api/production-access/crew/route");
      const join = event.joinCode;
      // Six spellings of one event, each a fresh count under the old typed-text key.
      const variants = [join, `${join} `, ` ${join.toLowerCase()}`, join.replace("-", " "), join.replace("-", ""), `  ${join}  `];
      for (const eventCode of variants) {
        expect((await POST(gatePost("crew", { eventCode, password: "wrong-guess" }))).headers.get("location")).toContain("error=invalid");
      }
      const seventh = await POST(gatePost("crew", { eventCode: join.toLowerCase(), password: event.accessCodes!.crew! }));
      expect(seventh.headers.get("location")).toContain("error=too_many");
      expect(seventh.cookies.getAll()).toHaveLength(0);
    });

    it("crew door: varying the code over unknown events is one count", async () => {
      (await freshIsolate()).setGateLimiterForTests(sharedBinding());
      const { POST } = await import("@/app/api/production-access/crew/route");
      for (let attempt = 1; attempt <= GATE_ATTEMPTS_PER_WINDOW; attempt += 1) {
        expect((await POST(gatePost("crew", { eventCode: `x${attempt}`, password: `wrong-guess-${attempt}` }))).headers.get("location")).not.toContain("too_many");
      }
      const seventh = await POST(gatePost("crew", { eventCode: "x7", password: "crew-test-password" }));
      expect(seventh.headers.get("location")).toContain("error=too_many");
      expect(seventh.cookies.getAll()).toHaveLength(0);
    });

    it("special-guest door: padded variants of a real event's code are one count; the right code on the 7th gets no cookie", async () => {
      (await freshIsolate()).setGateLimiterForTests(sharedBinding());
      const event = await realEvent();
      const { POST } = await import("@/app/api/production-access/special-guest/route");
      const join = event.joinCode;
      for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW; attempt += 1) {
        const response = await POST(gatePost("special-guest", { eventCode: `${" ".repeat(attempt)}${join}${" ".repeat(attempt)}`, roleCode: `WPL-SPEAKER-WRONG${attempt}` }));
        expect(response.headers.get("location")).not.toContain("too_many");
      }
      const seventh = await POST(gatePost("special-guest", { eventCode: join.toLowerCase(), roleCode: event.accessCodes!.speaker! }));
      expect(seventh.headers.get("location")).toContain("error=too_many");
      expect(seventh.cookies.getAll()).toHaveLength(0);
    });

    it("unknown event codes at the guest door share the one unknown-event count", async () => {
      const binding = sharedBinding();
      (await freshIsolate()).setGateLimiterForTests(binding);
      const { POST } = await import("@/app/api/production-access/special-guest/route");
      await POST(gatePost("special-guest", { eventCode: "nope-1", roleCode: "x" }));
      await POST(gatePost("special-guest", { eventCode: "nope-2", roleCode: "x" }));
      expect(binding.calls).toEqual([`special_guest:${UNKNOWN_EVENT_SCOPE}:203.0.113.5`, `special_guest:${UNKNOWN_EVENT_SCOPE}:203.0.113.5`]);
    });
  });

  // The owner password at every other door, limited or in an outage: tests/unit/ownerAtEveryDoor.test.ts.

  describe("outage: the binding is missing or failing in a Worker", () => {
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));

    it("owner and operator refuse a password that is not hers with the paused notice, never let the attempt through", async () => {
      const isolate = await freshIsolate();
      isolate.setGateLimiterForTests(undefined);
      const owner = await (await import("@/app/api/production-access/owner/route")).POST(gatePost("owner", { password: "a-guess-in-an-outage" }));
      expect(owner.headers.get("location")).toContain("/production-access/owner?error=paused");
      expect(owner.cookies.getAll()).toHaveLength(0);
      const operator = await (await import("@/app/api/production-access/operator/route")).POST(gatePost("operator", { password: "operator-test-password" }));
      expect(operator.headers.get("location")).toContain("/production-access/operator?error=paused");
      expect(operator.cookies.getAll()).toHaveLength(0);
      expect(await isolate.takeGateAttempt({ gate: "crew", scope: "event-45minu" })).toEqual({ allowed: false, reason: "limiter_unavailable" });
    });

    it("a binding that throws is the same outage, refused for the production doors", async () => {
      setGateLimiterForTests({ limit: async () => { throw new Error("rate limiter unavailable"); } });
      expect(await takeGateAttempt({ gate: "owner" })).toEqual({ allowed: false, reason: "limiter_unavailable" });
      expect(console.error).toHaveBeenCalled();
    });

    it("guest doors let the attempt through, logged, so speakers are not locked out of a running show", async () => {
      setGateLimiterForTests(undefined);
      expect(await takeGateAttempt({ gate: "special_guest", scope: "event-45minu" })).toEqual({ allowed: true, degraded: true });
      expect(await takeGateAttempt({ gate: "attendee_return", scope: "event-1" })).toEqual({ allowed: true, degraded: true });
      expect(console.error).toHaveBeenCalledTimes(2);
    });
  });

  it("outside a Worker (next dev / next start, no Cloudflare context) the in-process stand-in counts", async () => {
    for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW; attempt += 1) expect((await takeGateAttempt({ ip: "203.0.113.5", gate: "owner" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "203.0.113.5", gate: "owner" })).allowed).toBe(false);
  });
});
