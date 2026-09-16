import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The /request-event front door used to show "Request received" unconditionally.
 * Its store wrote a JSON file through require("fs") — impossible on the Worker
 * this site deploys to — and returned the same record whether or not anything
 * had been written, so the visitor was told their request had arrived even when
 * it had reached nothing at all.
 *
 * These tests exist so that cannot come back. The contract under test is
 * narrow and absolute: the success page is reachable only when a durable
 * destination confirmed the request.
 */

const ORIGINAL_ENV = { ...process.env };

/** Captures the redirect target the way Next's redirect() behaves: by throwing. */
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

const appendRequestEventRecord = vi.fn<(record: unknown) => Promise<unknown>>();
const sendEmail = vi.fn<(message: unknown) => Promise<unknown>>();
const createAuditLog = vi.fn<(input: { action: string }) => Promise<unknown>>(async () => ({}));

vi.mock("@/services/events/requestEventStore", () => ({
  appendRequestEventRecord: (record: unknown) => appendRequestEventRecord(record),
}));
vi.mock("@/services/events/eventRepository", () => ({
  createEventRecord: vi.fn(async () => ({ id: "acme-health-webinar-request" })),
}));

vi.mock("@/services/email/emailService", () => ({
  sendEmail: (message: unknown) => sendEmail(message),
}));
vi.mock("@/services/audit/createAuditLog", () => ({
  createAuditLog: (input: { action: string }) => createAuditLog(input),
}));

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("name", "Ada Lovelace");
  data.set("email", "ada@example.com");
  for (const [key, value] of Object.entries(overrides)) data.set(key, value);
  return data;
}

/** Runs the action and returns the URL it redirected to. */
async function runAction(data: FormData) {
  const { requestEventProduction } = await import("@/lib/actions/requestEventActions");
  try {
    await requestEventProduction(data);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("action returned without redirecting");
}

const stored = { ok: true as const, record: { id: "request-1" } };
const dropped = { ok: false as const, record: { id: "request-1" }, reason: "supabase_not_configured" };

describe("request-event intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_REPLY_TO = "producers@westpeek.live";
    // Silence the deliberate operator breadcrumb on the failure paths.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("shows receipt when the request was stored", async () => {
    appendRequestEventRecord.mockResolvedValue(stored);
    sendEmail.mockResolvedValue({ id: "e1", provider: "resend", status: "sent" });

    expect(await runAction(form())).toBe("/request-event?status=received");
  });

  it("does NOT show receipt when nothing stored it and no mail was delivered", async () => {
    appendRequestEventRecord.mockResolvedValue(dropped);
    sendEmail.mockResolvedValue({ id: "e1", provider: "resend", status: "sent" });

    // Sanity: with a real send this is a receipt...
    expect(await runAction(form())).toBe("/request-event?status=received");

    // ...but with nothing durable at all, it must not be.
    appendRequestEventRecord.mockResolvedValue(dropped);
    sendEmail.mockRejectedValue(new Error("Resend email failed: 401"));

    expect(await runAction(form())).toBe("/request-event?status=failed");
  });

  it("treats an unconfigured mock mailer as undelivered, not as receipt", async () => {
    // This is the exact production hazard: with RESEND_API_KEY unset the app
    // silently falls back to MockEmailProvider, which discards the message and
    // reports provider "mock". That must never satisfy the receipt condition.
    appendRequestEventRecord.mockResolvedValue(dropped);
    sendEmail.mockResolvedValue({ id: "mock-email-1", provider: "mock", status: "queued" });

    expect(await runAction(form())).toBe("/request-event?status=failed");
  });

  it("still shows receipt when storage failed but mail genuinely went out", async () => {
    appendRequestEventRecord.mockResolvedValue(dropped);
    sendEmail.mockResolvedValue({ id: "e1", provider: "resend", status: "sent" });

    expect(await runAction(form())).toBe("/request-event?status=received");
  });

  it("does not show receipt when there is no recipient configured to mail", async () => {
    delete process.env.EMAIL_REPLY_TO;
    delete process.env.EMAIL_FROM;
    appendRequestEventRecord.mockResolvedValue(dropped);

    expect(await runAction(form())).toBe("/request-event?status=failed");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("records why a request was dropped", async () => {
    appendRequestEventRecord.mockResolvedValue(dropped);
    sendEmail.mockRejectedValue(new Error("nope"));

    await runAction(form());

    const actions = createAuditLog.mock.calls.map((call) => call[0].action);
    expect(actions).toContain("request_event_production");
    expect(actions).toContain("request_event_persist_failed");
  });

  it("rejects a submission with no valid email before touching any store", async () => {
    expect(await runAction(form({ email: "not-an-address" }))).toBe("/request-event?status=missing");
    expect(appendRequestEventRecord).not.toHaveBeenCalled();
  });
});

describe("request-event store", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("reports failure rather than success when there is nowhere to store", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();

    const store = await vi.importActual<typeof import("@/services/events/requestEventStore")>(
      "@/services/events/requestEventStore",
    );

    const result = await store.appendRequestEventRecord({
      id: "request-x",
      name: "Ada Lovelace",
      email: "ada@example.com",
      createdAt: new Date().toISOString(),
    });

    // The old implementation returned the record here, which read as success.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("supabase_not_configured");
  });

  it("never throws out of the intake path", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();

    const store = await vi.importActual<typeof import("@/services/events/requestEventStore")>(
      "@/services/events/requestEventStore",
    );

    await expect(
      store.appendRequestEventRecord({
        id: "request-y",
        name: "Ada Lovelace",
        email: "ada@example.com",
        createdAt: new Date().toISOString(),
      }),
    ).resolves.toBeDefined();
  });
});
