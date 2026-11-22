import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { RateLimitBindingLike } from "@/lib/d1/binding";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { createInProcessRateLimiter, GATE_ATTEMPTS_PER_WINDOW, GATE_WINDOW_SECONDS, resetGateAttemptsForTests, setGateLimiterForTests, takeGateAttempt } from "@/services/access/gateAttemptLimiter";

/**
 * Readable codes (WPL-CREW-45MINU) are guessable from a public event name on purpose, so the gate
 * is where that is paid for: a few tries a minute from one place, then a wait. The count lives in the
 * Cloudflare Rate Limiting binding, shared by every isolate; these tests stand in for the binding
 * with one shared counter and load the limiter module fresh to play a new isolate.
 */
const OWNER_PASSWORD = "owner-test-master-2027";

/** One counter for "the Cloudflare location", as the binding is: every isolate sees the same one. */
function sharedBinding(): RateLimitBindingLike & { calls: string[] } {
  const inner = createInProcessRateLimiter(GATE_ATTEMPTS_PER_WINDOW, GATE_WINDOW_SECONDS);
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
    expect((await takeGateAttempt({ ip: "203.0.113.5", eventCode: "WPL-45MINU", gate: "crew" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "203.0.113.5", eventCode: "WPL-45MINU", gate: "crew" })).allowed).toBe(true);
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

  it("brute force through the owner route: the right password after the limit is still refused", async () => {
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
    const response = await POST(gatePost("owner", { password: OWNER_PASSWORD }));
    expect(response.headers.get("location")).toContain("error=too_many");
    expect(response.cookies.getAll()).toHaveLength(0);
  });

  it("one prober does not lock out a different event, a different place or a different gate", async () => {
    setGateLimiterForTests(sharedBinding());
    for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW + 1; attempt += 1) await takeGateAttempt({ ip: "203.0.113.5", eventCode: "WPL-45MINU", gate: "crew" });
    expect((await takeGateAttempt({ ip: "203.0.113.5", eventCode: "WPL-45MINU", gate: "crew" })).allowed).toBe(false);
    expect((await takeGateAttempt({ ip: "203.0.113.5", eventCode: "WPL-OTHER", gate: "crew" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "198.51.100.9", eventCode: "WPL-45MINU", gate: "crew" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "203.0.113.5", eventCode: "WPL-45MINU", gate: "special_guest" })).allowed).toBe(true);
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
    (await freshIsolate()).setGateLimiterForTests(binding);
    const { POST } = await import("@/app/api/production-access/owner/route");
    await POST(gatePost("owner", { password: "a-secret-guess" }));
    expect(binding.calls).toEqual(["owner:-:203.0.113.5"]);
  });

  describe("outage: the binding is missing or failing in a Worker", () => {
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));

    it("owner and operator refuse with the paused notice, never let the attempt through", async () => {
      const isolate = await freshIsolate();
      isolate.setGateLimiterForTests(undefined);
      const owner = await (await import("@/app/api/production-access/owner/route")).POST(gatePost("owner", { password: OWNER_PASSWORD }));
      expect(owner.headers.get("location")).toContain("/production-access/owner?error=paused");
      expect(owner.cookies.getAll()).toHaveLength(0);
      const operator = await (await import("@/app/api/production-access/operator/route")).POST(gatePost("operator", { password: "operator-test-password" }));
      expect(operator.headers.get("location")).toContain("/production-access/operator?error=paused");
      expect(operator.cookies.getAll()).toHaveLength(0);
      expect(await isolate.takeGateAttempt({ gate: "crew", eventCode: "WPL-45MINU" })).toEqual({ allowed: false, reason: "limiter_unavailable" });
    });

    it("a binding that throws is the same outage, refused for the production doors", async () => {
      setGateLimiterForTests({ limit: async () => { throw new Error("rate limiter unavailable"); } });
      expect(await takeGateAttempt({ gate: "owner" })).toEqual({ allowed: false, reason: "limiter_unavailable" });
      expect(console.error).toHaveBeenCalled();
    });

    it("guest doors let the attempt through, logged, so speakers are not locked out of a running show", async () => {
      setGateLimiterForTests(undefined);
      expect(await takeGateAttempt({ gate: "special_guest", eventCode: "WPL-45MINU" })).toEqual({ allowed: true, degraded: true });
      expect(await takeGateAttempt({ gate: "attendee_return", eventCode: "event-1" })).toEqual({ allowed: true, degraded: true });
      expect(console.error).toHaveBeenCalledTimes(2);
    });
  });

  it("outside a Worker (next dev / next start, no Cloudflare context) the in-process stand-in counts", async () => {
    for (let attempt = 0; attempt < GATE_ATTEMPTS_PER_WINDOW; attempt += 1) expect((await takeGateAttempt({ ip: "203.0.113.5", gate: "owner" })).allowed).toBe(true);
    expect((await takeGateAttempt({ ip: "203.0.113.5", gate: "owner" })).allowed).toBe(false);
  });
});
