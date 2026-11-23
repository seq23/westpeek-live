import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two doors that are server actions, not gate routes: the lobby VIP card (its redirect answers
 * yes or no, so it is an oracle like any gate) and the agency account login. Both are counted before
 * the secret is checked; the login refuses outright when the count cannot be taken.
 * Only the edges are stood in for: the request headers, the redirect, and the secret check itself.
 */
const requestHeaders = new Headers({ "cf-connecting-ip": "2001:db8:aa:bb::1" });
vi.mock("next/headers", () => ({ headers: async () => requestHeaders, cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
class Redirect extends Error {}
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Redirect(url); } }));

const redeemVipCode = vi.fn(async () => ({ ok: false }));
vi.mock("@/services/guests/vipGrantService", () => ({ redeemVipCode: (...args: unknown[]) => redeemVipCode(...(args as [])), grantVip: vi.fn(), revokeVip: vi.fn(), setVipInviteList: vi.fn() }));
vi.mock("@/services/attendees/attendeeSessionService", () => ({ getCurrentAttendeeProfile: async (eventId: string) => ({ eventId, attendeeId: "a1", name: "Pat", email: "pat@example.test" }) }));
const signIn = vi.fn(async () => ({ ok: false as const }));
const createPasswordReset = vi.fn<(email: string) => Promise<{ token: string; userId: string; expiresAt: string } | undefined>>(async () => ({ token: "a".repeat(64), userId: "u1", expiresAt: "2026-11-23T12:00:00.000Z" }));
vi.mock("@/lib/auth/passwordAuth", () => ({ PasswordAuth: class {
  signIn(...args: unknown[]) { return signIn(...(args as [])); }
  createPasswordReset(email: string) { return createPasswordReset(email); }
} }));
const sendEmail = vi.fn(async () => ({ id: "e1", provider: "resend", status: "sent" }));
vi.mock("@/services/email/emailService", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...(args as [])) }));
vi.mock("@/lib/auth/sessionCookie", () => ({ setAuthCookie: vi.fn(), clearAuthCookie: vi.fn(), getAuthCookiePayload: vi.fn() }));

import { GATE_ATTEMPTS_PER_WINDOW, resetGateAttemptsForTests, setGateLimiterForTests, createInProcessRateLimiter } from "@/services/access/gateAttemptLimiter";
import { redeemVipCodeAction } from "@/lib/actions/vipActions";
import { loginWithPassword, requestPasswordReset } from "@/lib/auth/actions";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

async function landing(action: Promise<unknown>) {
  try { await action; } catch (error) { if (error instanceof Redirect) return error.message; throw error; }
  return "";
}

describe("doors that are server actions are counted before the secret is checked", () => {
  beforeEach(() => {
    resetGateAttemptsForTests();
    redeemVipCode.mockClear();
    signIn.mockClear();
  });
  afterEach(() => {
    setGateLimiterForTests("unset");
    vi.restoreAllMocks();
  });

  it("VIP card: six guesses are checked, the 7th is told to wait and never checked; a fresh address in the same /64 changes nothing", async () => {
    setGateLimiterForTests(createInProcessRateLimiter());
    for (let attempt = 1; attempt <= GATE_ATTEMPTS_PER_WINDOW; attempt += 1) {
      requestHeaders.set("cf-connecting-ip", `2001:db8:aa:bb::${attempt}`);
      expect(await landing(redeemVipCodeAction(form({ eventId: "evt-1", code: `WPL-VIP-GUESS${attempt}` })))).toBe("/venue/evt-1/lobby?vip=no");
    }
    requestHeaders.set("cf-connecting-ip", "2001:db8:aa:bb::99");
    expect(await landing(redeemVipCodeAction(form({ eventId: "evt-1", code: "WPL-VIP-RIGHT" })))).toBe("/venue/evt-1/lobby?vip=wait");
    expect(redeemVipCode).toHaveBeenCalledTimes(GATE_ATTEMPTS_PER_WINDOW);
  });

  it("VIP card in an outage stays open (an attendee door), and is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setGateLimiterForTests(undefined);
    expect(await landing(redeemVipCodeAction(form({ eventId: "evt-1", code: "WPL-VIP-X" })))).toBe("/venue/evt-1/lobby?vip=no");
    expect(redeemVipCode).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
  });

  it("login: six tries per account and address are checked; the 7th is refused unchecked, whatever case the email is typed in", async () => {
    setGateLimiterForTests(createInProcessRateLimiter());
    requestHeaders.set("cf-connecting-ip", "203.0.113.9");
    for (let attempt = 1; attempt <= GATE_ATTEMPTS_PER_WINDOW; attempt += 1) {
      expect(await landing(loginWithPassword(form({ email: attempt % 2 ? "owner@example.test" : "OWNER@Example.test", password: `guess-${attempt}` })))).toContain("error=invalid_login");
    }
    const seventh = await landing(loginWithPassword(form({ email: "owner@example.test", password: "the-right-one" })));
    expect(seventh).toMatch(/^\/login\?error=too_many&retry=\d+&next=/);
    expect(signIn).toHaveBeenCalledTimes(GATE_ATTEMPTS_PER_WINDOW);
  });

  it("login in an outage is refused, never checked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setGateLimiterForTests(undefined);
    expect(await landing(loginWithPassword(form({ email: "owner@example.test", password: "anything" })))).toMatch(/^\/login\?error=paused&next=/);
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("the reset form is counted before any account is looked up, the same for every address", () => {
  beforeEach(() => {
    resetGateAttemptsForTests();
    createPasswordReset.mockClear();
    sendEmail.mockClear();
  });
  afterEach(() => {
    setGateLimiterForTests("unset");
    vi.restoreAllMocks();
  });

  async function sixThenSeventh(email: string) {
    const landings: string[] = [];
    for (let ask = 1; ask <= GATE_ATTEMPTS_PER_WINDOW + 1; ask += 1) landings.push(await landing(requestPasswordReset(form({ email }))));
    return landings;
  }

  it("six asks for one account from one address are handled, the 7th is told to wait and looks nothing up, whatever case is typed", async () => {
    setGateLimiterForTests(createInProcessRateLimiter());
    requestHeaders.set("cf-connecting-ip", "198.51.100.7");
    const landings = await sixThenSeventh("Owner@Example.test");
    expect(landings.slice(0, GATE_ATTEMPTS_PER_WINDOW)).toEqual(Array(GATE_ATTEMPTS_PER_WINDOW).fill("/login?notice=password_reset_sent"));
    expect(landings[GATE_ATTEMPTS_PER_WINDOW]).toBe("/forgot-password?error=too_many&retry=60");
    expect(createPasswordReset).toHaveBeenCalledTimes(GATE_ATTEMPTS_PER_WINDOW);
    expect(sendEmail).toHaveBeenCalledTimes(GATE_ATTEMPTS_PER_WINDOW);
    expect(await landing(requestPasswordReset(form({ email: "owner@example.test" })))).toBe("/forgot-password?error=too_many&retry=60");
  });

  it("an address with no account, or an account past its hourly links, gets exactly the same answers and no mail", async () => {
    setGateLimiterForTests(createInProcessRateLimiter());
    requestHeaders.set("cf-connecting-ip", "198.51.100.8");
    const real = await sixThenSeventh("real@example.test");
    resetGateAttemptsForTests();
    setGateLimiterForTests(createInProcessRateLimiter());
    sendEmail.mockClear();
    createPasswordReset.mockResolvedValue(undefined); // no such account, or its 3 links this hour are spent
    const none = await sixThenSeventh("nobody@example.test");
    expect(none).toEqual(real);
    expect(sendEmail).not.toHaveBeenCalled();
    createPasswordReset.mockReset();
    createPasswordReset.mockResolvedValue({ token: "a".repeat(64), userId: "u1", expiresAt: "2026-11-23T12:00:00.000Z" });
  });

  it("in a limiter outage the form refuses and sends nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setGateLimiterForTests(undefined);
    expect(await landing(requestPasswordReset(form({ email: "owner@example.test" })))).toBe("/forgot-password?error=reset_paused");
    expect(createPasswordReset).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
