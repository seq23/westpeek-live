import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Her ruling (22 Nov 2026): the owner password is accepted at every door. Guessing stays bounded:
 * six misses in a minute lock that address at that door for 60 s, never another address, and with
 * the limiter down the right password still opens while a wrong one is refused. Every door in
 * OWNER_PASSWORD_DOORS is tried with the test fixture's owner password. A door added to the
 * registry without a harness here fails the first test, and the view-as validator fails a door
 * with a count that is not in the registry.
 */
const OWNER_PASSWORD = "owner-test-master-2027";
const jar = new Map<string, string>();
const address = { ip: "203.0.113.7" };
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "cf-connecting-ip": address.ip }),
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); }, delete: (name: string) => { jar.delete(name); } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
class Redirect extends Error {}
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Redirect(url); } }));
vi.mock("@/services/attendees/attendeeSessionService", () => ({ getCurrentAttendeeProfile: async () => undefined }));
vi.mock("@/lib/auth/passwordAuth", () => ({ PasswordAuth: class { async signIn() { return { ok: false as const }; } } }));
vi.mock("@/lib/auth/sessionCookie", () => ({ setAuthCookie: vi.fn(), clearAuthCookie: vi.fn(), getAuthCookiePayload: vi.fn() }));

import { OWNER_PASSWORD_DOORS } from "@/lib/auth/ownerAtEveryDoor";
import { createInProcessRateLimiter, GATE_ATTEMPTS_PER_WINDOW, resetGateAttemptsForTests, setGateLimiterForTests, type GateName } from "@/services/access/gateAttemptLimiter";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";

function post(gate: string, fields: Record<string, string>) {
  return new NextRequest(`http://localhost/api/production-access/${gate}`, { method: "POST", body: new URLSearchParams(fields), headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": address.ip } });
}
function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
async function viaAction(run: () => Promise<unknown>) {
  try { await run(); } catch (error) { if (error instanceof Redirect) return { location: error.message, cookies: Array.from(jar.values()) }; throw error; }
  return { location: "", cookies: Array.from(jar.values()) };
}
async function viaRoute(response: Promise<Response & { cookies?: { getAll(): { value: string }[] } }>) {
  const answer = await response as unknown as { headers: Headers; cookies: { getAll(): { value: string }[] } };
  return { location: answer.headers.get("location") || "", cookies: answer.cookies.getAll().map((cookie) => cookie.value) };
}

/** How each door is entered with a password typed into its secret field. null: the door has no secret field. */
const ENTER: Record<GateName, ((secret: string) => Promise<{ location: string; cookies: string[] }>) | null> = {
  owner: async (secret) => viaRoute((await import("@/app/api/production-access/owner/route")).POST(post("owner", { password: secret }))),
  operator: async (secret) => viaRoute((await import("@/app/api/production-access/operator/route")).POST(post("operator", { password: secret }))),
  crew: async (secret) => viaRoute((await import("@/app/api/production-access/crew/route")).POST(post("crew", { eventCode: "wpl-ab12cd", password: secret }))),
  special_guest: async (secret) => viaRoute((await import("@/app/api/production-access/special-guest/route")).POST(post("special-guest", { eventCode: "wpl-ab12cd", roleCode: secret }))),
  vip_redeem: async (secret) => viaAction(async () => (await import("@/lib/actions/vipActions")).redeemVipCodeAction(form({ eventId: "evt-1", code: secret }))),
  login: async (secret) => viaAction(async () => (await import("@/lib/auth/actions")).loginWithPassword(form({ email: "anyone@example.test", password: secret }))),
  attendee_return: null,
};

async function ownerCookies(cookies: string[]) {
  const payloads = await Promise.all(cookies.map((value) => readV5AccessCookie(value, "test-cookie-secret-test-cookie-secret").catch(() => undefined)));
  return payloads.filter((payload) => payload?.kind === "owner");
}

describe("the owner password is accepted at every door", () => {
  let tempDir: string;
  beforeEach(() => {
    jar.clear();
    resetGateAttemptsForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-owner-doors-"));
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    vi.stubEnv("OWNER_MASTER_ACCESS_PASSWORD", OWNER_PASSWORD);
    vi.stubEnv("CREW_ACCESS_PASSWORD", "crew-test-password");
    vi.stubEnv("OPERATOR_LAUNCHPAD_PASSWORD", "operator-test-password");
    vi.stubEnv("V5_ACCESS_COOKIE_SECRET", "test-cookie-secret-test-cookie-secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    setGateLimiterForTests("unset");
    setRuntimeStoreForTests(undefined);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("every registered door has a way in here, and only a door with no secret field has none", () => {
    for (const [gate, door] of Object.entries(OWNER_PASSWORD_DOORS) as [GateName, (typeof OWNER_PASSWORD_DOORS)[GateName]][]) {
      expect(ENTER[gate] === null, gate).toBe("noSecret" in door);
    }
    expect(Object.values(ENTER).filter(Boolean).length).toBeGreaterThanOrEqual(6);
  });

  it("opens every door from the route list with the owner password, counted as usual", async () => {
    setGateLimiterForTests(createInProcessRateLimiter(), createInProcessRateLimiter(1000));
    for (const [gate, enter] of Object.entries(ENTER)) {
      if (!enter) continue;
      jar.clear();
      const result = await enter(OWNER_PASSWORD);
      expect(await ownerCookies(result.cookies), `${gate}: ${result.location}`).toHaveLength(1);
      expect(result.location, gate).not.toMatch(/error=|vip=wait|vip=no|register/);
    }
  });

  it("six wrong tries from address A lock A at that door, not B; A's lock refuses even the right password", async () => {
    for (const [gate, enter] of Object.entries(ENTER)) {
      if (!enter) continue;
      resetGateAttemptsForTests();
      setGateLimiterForTests(createInProcessRateLimiter(), createInProcessRateLimiter(1000));
      address.ip = "203.0.113.10";
      for (let miss = 1; miss <= GATE_ATTEMPTS_PER_WINDOW; miss += 1) { jar.clear(); await enter(`wrong-${miss}`); }
      jar.clear();
      const locked = await enter(OWNER_PASSWORD);
      expect(await ownerCookies(locked.cookies), `${gate} A locked`).toHaveLength(0);
      address.ip = "198.51.100.20";
      jar.clear();
      const other = await enter(OWNER_PASSWORD);
      expect(await ownerCookies(other.cookies), `${gate} B: ${other.location}`).toHaveLength(1);
    }
    address.ip = "203.0.113.7";
  });

  it("five misses of her own and the sixth try is still hers", async () => {
    setGateLimiterForTests(createInProcessRateLimiter(), createInProcessRateLimiter(1000));
    for (let miss = 1; miss < GATE_ATTEMPTS_PER_WINDOW; miss += 1) await ENTER.owner!(`typo-${miss}`);
    expect(await ownerCookies((await ENTER.owner!(OWNER_PASSWORD)).cookies)).toHaveLength(1);
  });

  it("with the limiter down the right password opens every door, logged as degraded, and a wrong one is refused", async () => {
    setGateLimiterForTests(undefined);
    for (const [gate, enter] of Object.entries(ENTER)) {
      if (!enter) continue;
      jar.clear();
      const right = await enter(OWNER_PASSWORD);
      expect(await ownerCookies(right.cookies), `${gate}: ${right.location}`).toHaveLength(1);
      jar.clear();
      const wrong = await enter("not-the-owner-password");
      expect(await ownerCookies(wrong.cookies), gate).toHaveLength(0);
      expect(wrong.location, gate).toMatch(/error=|vip=wait|vip=no|register/);
    }
    expect(vi.mocked(console.error).mock.calls.some((call) => String(call[0]).includes("let in uncounted"))).toBe(true);
  });

  it("the special-guest door lands her on Preview a guest for the typed event", async () => {
    const result = await ENTER.special_guest!(OWNER_PASSWORD);
    expect(result.location).toContain("/production-access/special-guest/preview?event=wpl-ab12cd");
  });
});
