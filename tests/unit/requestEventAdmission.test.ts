import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestD1 } from "./helpers/d1";
import { setD1ForTests } from "@/lib/d1/binding";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { createInProcessRateLimiter, resetGateAttemptsForTests, setGateLimiterForTests } from "@/services/access/gateAttemptLimiter";
import { appendRequestEventRecord } from "@/services/events/requestEventStore";
import { admitEventRequest, REQUEST_EVENT_DAILY_CAPS, utcDayStart } from "@/services/events/requestEventAdmission";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { sha256Hex } from "@/lib/security/portableCrypto";
import type { RuntimeStore } from "@/services/runtime/runtimeStore";

/**
 * /request-event mails the owner and makes a draft event for every request it takes. An outside scan
 * (23 Nov 2026) showed anyone could script it. These run the real action, the real gate limiter, the
 * real Turnstile verdicts (siteverify answered by a stub, the only thing faked besides the mailer and
 * the draft maker) and the real daily counts in a real D1.
 */

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

let callerIp = "198.51.100.1";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-connecting-ip": callerIp }) }));

const sendEmail = vi.fn<(message: { subject: string; html: string; text: string }) => Promise<unknown>>(async () => ({ id: "e1", provider: "resend", status: "sent" }));
vi.mock("@/services/email/emailService", () => ({ sendEmail: (message: { subject: string; html: string; text: string }) => sendEmail(message) }));
const createEventRecord = vi.fn(async () => ({ id: "draft-1" }));
vi.mock("@/services/events/eventRepository", () => ({ createEventRecord: () => createEventRecord() }));
vi.mock("@/services/audit/createAuditLog", () => ({ createAuditLog: async () => ({}) }));

/** siteverify, as Cloudflare answers it. GOOD is a token Turnstile issued for this form. */
const GOOD = "token-issued-for-request-event";
const OTHER_FORM = "token-issued-for-another-form";
type Siteverify = "answers" | "down" | "http_500";
let siteverify: Siteverify = "answers";
const siteverifyCalls: string[] = [];
async function fakeSiteverify(_url: unknown, init?: RequestInit) {
  const token = String((init?.body as FormData).get("response"));
  siteverifyCalls.push(token);
  if (siteverify === "down") throw new TypeError("fetch failed");
  if (siteverify === "http_500") return new Response("upstream", { status: 500 });
  if (token === GOOD) return Response.json({ success: true, action: "request_event" });
  if (token === OTHER_FORM) return Response.json({ success: true, action: "login" });
  return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
}

function form(token?: string, name = "Smoke TEST") {
  const data = new FormData();
  data.set("name", name);
  data.set("email", "requester@example.com");
  data.set("budgetRange", "25k_50k");
  if (token !== undefined) data.set("cf-turnstile-response", token);
  return data;
}

async function submit(data: FormData) {
  const { requestEventProduction } = await import("@/lib/actions/requestEventActions");
  try {
    await requestEventProduction(data);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("action returned without redirecting");
}

const ORIGINAL_ENV = { ...process.env };
let db: Awaited<ReturnType<typeof createTestD1>>;
async function rows() {
  const result = await db.db.prepare("SELECT requester_ip_hash, bot_check, created_at FROM request_event_intake ORDER BY created_at").all<{ requester_ip_hash: string | null; bot_check: string | null; created_at: string }>();
  return result.results ?? [];
}
/** Requests already in the inbox today, from `ipHash`, written the way the action writes them. */
async function seed(count: number, input: { ipHash: (i: number) => string; botCheck: "passed" | "unchecked"; createdAt: string }) {
  for (let i = 0; i < count; i += 1) {
    const stored = await appendRequestEventRecord({ id: `seed-${input.createdAt}-${input.botCheck}-${i}`, name: "Smoke TEST seed", email: "seed@example.com", budgetRange: "25k_50k", requesterIpHash: input.ipHash(i), botCheck: input.botCheck, createdAt: input.createdAt });
    expect(stored.ok).toBe(true);
  }
}

beforeEach(async () => {
  db = await createTestD1();
  setD1ForTests(db.db);
  setRuntimeStoreForTests(undefined);
  resetGateAttemptsForTests();
  // Each caller gets the binding's real per-minute burst counts.
  setGateLimiterForTests(createInProcessRateLimiter());
  vi.stubGlobal("fetch", vi.fn(fakeSiteverify));
  siteverify = "answers";
  siteverifyCalls.length = 0;
  callerIp = "198.51.100.1";
  process.env.TURNSTILE_SECRET_KEY = "turnstile-secret-for-tests";
  // The test setup forces the file store; these run against the real D1 store.
  process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "";
  process.env.EMAIL_REPLY_TO = "producers@example.com";
  sendEmail.mockClear();
  createEventRecord.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}, 30_000);

afterEach(async () => {
  setD1ForTests(undefined);
  setRuntimeStoreForTests(undefined);
  setGateLimiterForTests("unset");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.TURNSTILE_SECRET_KEY;
  process.env = { ...ORIGINAL_ENV };
  await db.dispose();
});

describe("a request Turnstile vouched for", () => {
  it("reaches the owner and the workspace, and the row says it was checked and from where", async () => {
    expect(await submit(form(GOOD))).toBe("/request-event?status=received");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].subject).toBe("New West Peek Live event request: Smoke TEST");
    expect(createEventRecord).toHaveBeenCalledTimes(1);
    expect(await rows()).toEqual([expect.objectContaining({ bot_check: "passed", requester_ip_hash: await sha256Hex("198.51.100.1") })]);
  }, 30_000);

  it("is capped at 5 a day from one address; the 6th sends nothing and points to the email address", async () => {
    for (let i = 0; i < REQUEST_EVENT_DAILY_CAPS.perAddress; i += 1) expect(await submit(form(GOOD))).toBe("/request-event?status=received");
    expect(await submit(form(GOOD))).toBe("/request-event?status=busy");
    expect(sendEmail).toHaveBeenCalledTimes(REQUEST_EVENT_DAILY_CAPS.perAddress);
    expect(createEventRecord).toHaveBeenCalledTimes(REQUEST_EVENT_DAILY_CAPS.perAddress);
    // Another address is still welcome.
    callerIp = "198.51.100.2";
    expect(await submit(form(GOOD))).toBe("/request-event?status=received");
  }, 30_000);

  it("is capped at 25 a day for the whole site, whoever sends it", async () => {
    await seed(REQUEST_EVENT_DAILY_CAPS.site - 1, { ipHash: (i) => `elsewhere-${i}`, botCheck: "passed", createdAt: new Date().toISOString() });
    callerIp = "198.51.100.50";
    expect(await submit(form(GOOD))).toBe("/request-event?status=received");
    callerIp = "198.51.100.51";
    expect(await submit(form(GOOD))).toBe("/request-event?status=busy");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  }, 60_000);
});

describe("a forged token", () => {
  it("is refused with nothing sent, drafted or stored, for a fake token and for another form's real one", async () => {
    expect(await submit(form("forged-token"))).toBe("/request-event?status=check");
    expect(await submit(form(OTHER_FORM))).toBe("/request-event?status=check");
    expect(await submit(form("x".repeat(2049)))).toBe("/request-event?status=check");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createEventRecord).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  }, 30_000);
});

describe("no token (an ad blocker ate the widget): delivered, under the tight unchecked caps", () => {
  it("lets one address send 2, marked in the subject, and refuses the 3rd with nothing sent", async () => {
    expect(await submit(form())).toBe("/request-event?status=received");
    expect(await submit(form(""))).toBe("/request-event?status=received");
    expect(await submit(form())).toBe("/request-event?status=busy");
    expect(sendEmail).toHaveBeenCalledTimes(REQUEST_EVENT_DAILY_CAPS.perAddressUnchecked);
    expect(sendEmail.mock.calls[0][0].subject).toBe("New West Peek Live event request (bot check not run): Smoke TEST");
    expect(createEventRecord).toHaveBeenCalledTimes(REQUEST_EVENT_DAILY_CAPS.perAddressUnchecked);
    expect((await rows()).map((row) => row.bot_check)).toEqual(["unchecked", "unchecked"]);
    // Siteverify was never asked about an empty token.
    expect(siteverifyCalls).toEqual([]);
    // The same address with a real check is still welcome: the unchecked cap does not punish it.
    expect(await submit(form(GOOD))).toBe("/request-event?status=received");
  }, 30_000);

  it("lets 5 a day through from the whole site, each from a different address; the 6th is refused", async () => {
    for (let i = 0; i < REQUEST_EVENT_DAILY_CAPS.siteUnchecked; i += 1) {
      callerIp = `203.0.113.${i + 1}`;
      expect(await submit(form())).toBe("/request-event?status=received");
    }
    callerIp = "203.0.113.99";
    expect(await submit(form())).toBe("/request-event?status=busy");
    expect(sendEmail).toHaveBeenCalledTimes(REQUEST_EVENT_DAILY_CAPS.siteUnchecked);
  }, 30_000);

  it("counts a caller with no address at all as one sender", async () => {
    callerIp = "";
    expect(await submit(form())).toBe("/request-event?status=received");
    expect(await submit(form())).toBe("/request-event?status=received");
    expect(await submit(form())).toBe("/request-event?status=busy");
  }, 30_000);
});

describe("outages never count as a passed check", () => {
  for (const outage of ["down", "http_500"] as const) {
    it(`siteverify ${outage}: the request is unchecked, under the unchecked caps`, async () => {
      siteverify = outage;
      expect(await submit(form(GOOD))).toBe("/request-event?status=received");
      expect(await submit(form(GOOD))).toBe("/request-event?status=received");
      expect(await submit(form(GOOD))).toBe("/request-event?status=busy");
      expect((await rows()).map((row) => row.bot_check)).toEqual(["unchecked", "unchecked"]);
      expect(sendEmail.mock.calls[0][0].subject).toContain("(bot check not run)");
    }, 30_000);
  }

  it("no secret configured: unchecked, never passed", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await submit(form(GOOD))).toBe("/request-event?status=received");
    expect((await rows()).map((row) => row.bot_check)).toEqual(["unchecked"]);
    expect(siteverifyCalls).toEqual([]);
  }, 30_000);

  it("Turnstile saying our own key is wrong is unchecked, not the visitor's fault", async () => {
    const answer = async () => Response.json({ success: false, "error-codes": ["invalid-input-secret"] });
    expect(await verifyTurnstile({ token: GOOD, action: "request_event", fetchImpl: answer as unknown as typeof fetch })).toEqual({ outcome: "unchecked", reason: "siteverify_invalid-input-secret" });
  });

  it("the daily count unreadable: refused as paused, nothing sent", async () => {
    setRuntimeStoreForTests({ kind: "d1", countEventRequestsSince: async () => { throw new Error("D1_ERROR: database unavailable"); } } as unknown as RuntimeStore);
    expect(await submit(form(GOOD))).toBe("/request-event?status=paused");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createEventRecord).not.toHaveBeenCalled();
  }, 30_000);

  it("the burst limiter unbound: refused as paused, nothing sent", async () => {
    setGateLimiterForTests(undefined);
    expect(await submit(form(GOOD))).toBe("/request-event?status=paused");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(siteverifyCalls).toEqual([]);
  }, 30_000);

  it("a burst from one address is stopped by the minute limiter before Turnstile or the database are asked", async () => {
    const admissions = [];
    for (let i = 0; i < 7; i += 1) admissions.push(await admitEventRequest({ ip: "198.51.100.9", turnstileToken: GOOD }));
    expect(admissions.slice(0, 6).every((a) => a.admitted)).toBe(true);
    expect(admissions[6]).toEqual({ admitted: false, status: "busy", reason: "gate_too_many" });
    expect(siteverifyCalls).toHaveLength(6);
  }, 30_000);
});

describe("the day is the UTC day", () => {
  it("yesterday's last-millisecond requests do not count against today; today's first-millisecond ones do", async () => {
    const now = new Date("2026-11-24T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-11-23T23:59:59.999Z"))).toBe("2026-11-23T00:00:00.000Z");
    const ipHash = await sha256Hex("198.51.100.20");
    await seed(REQUEST_EVENT_DAILY_CAPS.perAddress, { ipHash: () => ipHash, botCheck: "passed", createdAt: "2026-11-23T23:59:59.999Z" });
    expect(await admitEventRequest({ ip: "198.51.100.20", turnstileToken: GOOD, now })).toMatchObject({ admitted: true, botCheck: "passed" });
    await seed(REQUEST_EVENT_DAILY_CAPS.perAddress, { ipHash: () => ipHash, botCheck: "passed", createdAt: "2026-11-24T00:00:00.000Z" });
    expect(await admitEventRequest({ ip: "198.51.100.20", turnstileToken: GOOD, now })).toEqual({ admitted: false, status: "busy", reason: "address_daily_cap" });
  }, 30_000);
});

describe("the owner's email", () => {
  it("shows what a stranger typed as text, never as markup", async () => {
    expect(await submit(form(GOOD, `<img src=x onerror="alert(1)">Ada`))).toBe("/request-event?status=received");
    const html = sendEmail.mock.calls[0][0].html;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;Ada");
  }, 30_000);
});
