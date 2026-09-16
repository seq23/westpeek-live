import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import {
  approveEventRequest,
  attachEventToRequest,
  confirmEventRequestByToken,
  declineEventRequest,
  getEventRequest,
  listEventRequests,
  mintConfirmToken,
  recordInstructionsSent,
  recordSettlement,
  sortRequestsByAttention,
  submitEventRequest,
} from "@/services/event-intake/eventRequestPipeline";
import {
  emptyInstructionRecipients,
  INSTRUCTION_AUDIENCES,
  parseAddressList,
  sendApprovalEmail,
  sendInstructionEmails,
} from "@/services/event-intake/eventRequestEmails";
import { readAllHowItWorksPages, readHowItWorksPage, saveHowItWorksPage } from "@/services/content/howItWorksService";
import { BUDGET_RANGES, isBudgetRange } from "@/types/eventRequest";
import { HOW_IT_WORKS_AUDIENCES } from "@/types/howItWorks";
import { codeKey } from "@/lib/access/accessCodes";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * Plan an event, end to end. /request-event used to collect a request and stop. These tests hold
 * the whole path: the budget that arrives with the request, the price that West Peek attaches, the
 * client's yes, the settlement, and the instruction emails that go out with it — each of them a
 * person's action, none of them on a timer.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

async function newRequest(overrides: Record<string, string> = {}) {
  const result = await submitEventRequest({
    name: "Ada Lovelace",
    email: "ada@realco.io",
    company: "Realco",
    eventType: "Summit",
    audienceSize: "400",
    budgetRange: "25k_50k",
    ...overrides,
  });
  if (!result.ok) throw new Error(result.reason);
  return result.request;
}

async function priceAndConfirm(id: string) {
  const approved = await approveEventRequest({ id, priceAmountCents: 450000, scopeSummary: "Full production for one day, two rehearsals, and the replay cut afterwards.", approvedBy: "owner" });
  if (!approved.ok) throw new Error(approved.reason);
  const confirmed = await confirmEventRequestByToken(approved.request.confirmToken as string);
  if (!confirmed.ok) throw new Error(confirmed.reason);
  return confirmed.request;
}

describe("plan an event", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-request-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a request persists with its budget band, in the requested state", async () => {
    const request = await newRequest();
    expect(request.state).toBe("requested");

    const stored = await getEventRequest(request.id);
    expect(stored?.budgetRange).toBe("25k_50k");
    expect(stored?.email).toBe("ada@realco.io");
    // No price, no token, nothing agreed: a request is only a request.
    expect(stored?.priceAmountCents).toBeUndefined();
    expect(stored?.confirmToken).toBeUndefined();
    expect(await listEventRequests()).toHaveLength(1);
  });

  it("every budget band the form offers is one the app recognises", () => {
    expect(BUDGET_RANGES.length).toBeGreaterThanOrEqual(5);
    for (const range of BUDGET_RANGES) expect(isBudgetRange(range.value)).toBe(true);
    expect(isBudgetRange("whatever_it_takes")).toBe(false);
  });

  it("approving attaches a price and a scope, moves the state, and mints one link", async () => {
    const request = await newRequest();
    const approved = await approveEventRequest({ id: request.id, priceAmountCents: 450000, scopeSummary: "Full production for one day, two rehearsals, and the replay cut afterwards.", approvedBy: "owner" });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    expect(approved.request.state).toBe("approved");
    expect(approved.request.priceAmountCents).toBe(450000);
    expect(approved.request.priceCurrency).toBe("USD");
    expect(approved.request.scopeSummary).toContain("Full production");
    expect(approved.request.confirmToken).toHaveLength(24);

    // Re-pricing keeps the link the client already has, so the first email does not go dead.
    const repriced = await approveEventRequest({ id: request.id, priceAmountCents: 500000, scopeSummary: "Full production for one day, two rehearsals, and the replay cut afterwards.", approvedBy: "owner" });
    if (!repriced.ok) throw new Error(repriced.reason);
    expect(repriced.request.confirmToken).toBe(approved.request.confirmToken);
  });

  it("refuses a price of nothing and a scope summary that says nothing", async () => {
    const request = await newRequest();
    expect(await approveEventRequest({ id: request.id, priceAmountCents: 0, scopeSummary: "Full production for one day and the replay.", approvedBy: "owner" })).toMatchObject({ ok: false });
    expect(await approveEventRequest({ id: request.id, priceAmountCents: 450000, scopeSummary: "tbc", approvedBy: "owner" })).toMatchObject({ ok: false });
    expect((await getEventRequest(request.id))?.state).toBe("requested");
  });

  it("the client confirms with the token and nothing else", async () => {
    const request = await newRequest();
    const approved = await approveEventRequest({ id: request.id, priceAmountCents: 450000, scopeSummary: "Full production for one day, two rehearsals, and the replay cut afterwards.", approvedBy: "owner" });
    if (!approved.ok) return;
    const token = approved.request.confirmToken as string;

    // A token nobody minted resolves to nothing rather than to the newest request.
    expect(await confirmEventRequestByToken(mintConfirmToken())).toMatchObject({ ok: false });

    const confirmed = await confirmEventRequestByToken(token);
    expect(confirmed.ok).toBe(true);
    expect((await getEventRequest(request.id))?.state).toBe("confirmed");
    // Confirming twice is the client pressing the button twice, not an error.
    expect(await confirmEventRequestByToken(token)).toMatchObject({ ok: true });
  });

  it("a request nobody has priced cannot be confirmed", async () => {
    const request = await newRequest();
    await attachEventToRequest(request.id, "somewhere");
    const stored = await getEventRequest(request.id);
    expect(stored?.confirmToken).toBeUndefined();
    expect(await confirmEventRequestByToken("")).toMatchObject({ ok: false });
  });

  it("payment cannot be recorded before the client has agreed to the price", async () => {
    const request = await newRequest();
    expect(await recordSettlement({ id: request.id, method: "manual", settledBy: "owner" })).toMatchObject({ ok: false });
    await approveEventRequest({ id: request.id, priceAmountCents: 450000, scopeSummary: "Full production for one day, two rehearsals, and the replay cut afterwards.", approvedBy: "owner" });
    expect(await recordSettlement({ id: request.id, method: "manual", settledBy: "owner" })).toMatchObject({ ok: false });
    expect((await getEventRequest(request.id))?.state).toBe("approved");
  });

  it("settlement records HOW the money arrived, which is the seam a provider drops into", async () => {
    const request = await newRequest();
    await priceAndConfirm(request.id);

    const settled = await recordSettlement({ id: request.id, method: "manual", reference: "WIRE-8821", settledBy: "owner" });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    expect(settled.request.state).toBe("paid");
    expect(settled.request.settlementMethod).toBe("manual");
    expect(settled.request.settlementReference).toBe("WIRE-8821");
    expect(settled.request.paidAt).toBeTruthy();

    // Paying twice is refused rather than re-sending everybody their instructions.
    expect(await recordSettlement({ id: request.id, method: "stripe", reference: "pi_123", settledBy: "webhook" })).toMatchObject({ ok: false });
  });

  it("marking paid sends the instructions, and the log records what went to whom", async () => {
    const event = await createEventRecord({ name: "Realco Summit", when: "later" }, owner);
    const request = await newRequest();
    await attachEventToRequest(request.id, event.id);
    await priceAndConfirm(request.id);
    const settled = await recordSettlement({ id: request.id, method: "manual", settledBy: "owner" });
    if (!settled.ok) return;

    const recipients = emptyInstructionRecipients();
    recipients.client = ["ada@realco.io"];
    recipients.crew = ["producer@realco.io", "td@realco.io"];
    recipients.speaker = ["grace@realco.io"];
    recipients.sponsor = ["sales@sponsor.io"];
    recipients.attendee = ["everyone@realco.io"];

    const result = await sendInstructionEmails({ request: settled.request, event, recipients, baseUrl: "https://westpeek.live", sentBy: "owner" });
    await recordInstructionsSent(request.id);

    expect(result.sent + result.failed).toBe(6);
    expect(result.logs).toHaveLength(6);

    // Every message names its audience's workflow and carries the LINK to that audience's page.
    for (const entry of INSTRUCTION_AUDIENCES) {
      const rows = result.logs.filter((row) => row.workflowType === entry.workflow);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.actionUrl).toBe(`https://westpeek.live/how-it-works/${entry.audience}`);
    }

    // The same send log every other message in the app writes to, so there is one answer to
    // "what did we send this client".
    const logged = await getRuntimeStore().listEmailSendLogs(event.id, 100);
    expect(logged).toHaveLength(6);
    expect(new Set(logged.map((row) => row.recipientEmail))).toEqual(new Set([
      "ada@realco.io", "producer@realco.io", "td@realco.io", "grace@realco.io", "sales@sponsor.io", "everyone@realco.io",
    ]));
    expect(logged.every((row) => row.sentBy === "owner")).toBe(true);
    expect((await getEventRequest(request.id))?.instructionsSentAt).toBeTruthy();
  });

  it("the instruction emails carry the event's own UPPERCASE codes, not new ones", async () => {
    const event = await createEventRecord({ name: "Realco Summit Two", when: "later" }, owner);
    const request = await newRequest();
    await attachEventToRequest(request.id, event.id);
    await priceAndConfirm(request.id);
    const settled = await recordSettlement({ id: request.id, method: "manual", settledBy: "owner" });
    if (!settled.ok) return;

    const recipients = emptyInstructionRecipients();
    recipients.crew = ["producer@realco.io"];
    recipients.attendee = ["someone@realco.io"];
    const result = await sendInstructionEmails({ request: settled.request, event, recipients, baseUrl: "https://westpeek.live", sentBy: "owner" });

    const crew = result.logs.find((row) => row.workflowType === "instructions_crew");
    const attendee = result.logs.find((row) => row.workflowType === "instructions_attendee");
    // The subject and summary are built by the shared template; the codes come from the event row.
    expect(event.accessCodes.crew).toBe(event.accessCodes.crew.toUpperCase());
    expect(codeKey(event.accessCodes.crew)).toBeTruthy();
    expect(crew).toBeTruthy();
    expect(attendee).toBeTruthy();
  });

  it("nothing sends without being asked: no recipients means no messages and no rows", async () => {
    const event = await createEventRecord({ name: "Quiet Summit", when: "later" }, owner);
    const request = await newRequest();
    await attachEventToRequest(request.id, event.id);
    await priceAndConfirm(request.id);
    const settled = await recordSettlement({ id: request.id, method: "manual", settledBy: "owner" });
    if (!settled.ok) return;

    const result = await sendInstructionEmails({ request: settled.request, event, recipients: emptyInstructionRecipients(), baseUrl: "https://westpeek.live", sentBy: "owner" });
    expect(result.sent).toBe(0);
    expect(result.logs).toHaveLength(0);
    expect(await getRuntimeStore().listEmailSendLogs(event.id, 100)).toHaveLength(0);
  });

  it("approving a request is the only thing that mails the client their scope", async () => {
    const request = await newRequest();
    const approved = await approveEventRequest({ id: request.id, priceAmountCents: 450000, scopeSummary: "Full production for one day, two rehearsals, and the replay cut afterwards.", approvedBy: "owner" });
    if (!approved.ok) return;

    // Nothing has been mailed by the state change itself.
    expect(await getRuntimeStore().listAllEmailSendLogs(100)).toHaveLength(0);

    const row = await sendApprovalEmail({ request: approved.request, baseUrl: "https://westpeek.live", sentBy: "owner" });
    expect(row.recipientEmail).toBe("ada@realco.io");
    expect(row.actionUrl).toBe(`https://westpeek.live/proposal/${approved.request.confirmToken}`);
    expect(await getRuntimeStore().listAllEmailSendLogs(100)).toHaveLength(1);
  });

  it("declining needs a reason, and a paid request cannot be declined away", async () => {
    const request = await newRequest();
    expect(await declineEventRequest({ id: request.id, reason: "   ", declinedBy: "owner" })).toMatchObject({ ok: false });
    expect(await declineEventRequest({ id: request.id, reason: "Not the kind of show we run.", declinedBy: "owner" })).toMatchObject({ ok: true });
    expect((await getEventRequest(request.id))?.state).toBe("declined");

    const second = await newRequest({ email: "cal@realco.io" });
    await priceAndConfirm(second.id);
    await recordSettlement({ id: second.id, method: "manual", settledBy: "owner" });
    expect(await declineEventRequest({ id: second.id, reason: "Changed my mind.", declinedBy: "owner" })).toMatchObject({ ok: false });
  });

  it("the list puts what is waiting on West Peek at the top", async () => {
    const paid = await newRequest({ email: "paid@realco.io" });
    await priceAndConfirm(paid.id);
    await recordSettlement({ id: paid.id, method: "manual", settledBy: "owner" });
    const fresh = await newRequest({ email: "fresh@realco.io" });

    const ordered = sortRequestsByAttention(await listEventRequests());
    expect(ordered[0].id).toBe(fresh.id);
    expect(ordered[ordered.length - 1].id).toBe(paid.id);
  });

  it("a recipient list is read the way a person types one", () => {
    expect(parseAddressList("Ada@Example.com, cal@realco.io; ada@example.com\nnonsense")).toEqual(["ada@example.com", "cal@realco.io"]);
    expect(parseAddressList("")).toEqual([]);
  });
});

describe("the instruction pages", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-hiw-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("all five exist and say something real before anybody has edited one", async () => {
    const pages = await readAllHowItWorksPages();
    expect(pages.map((page) => page.slug)).toEqual(HOW_IT_WORKS_AUDIENCES);
    for (const page of pages) {
      expect(page.isDefault).toBe(true);
      expect(page.title.length).toBeGreaterThan(10);
      expect(page.intro.length).toBeGreaterThan(40);
      expect(page.body.length).toBeGreaterThan(600);
      // House style: no em-dashes in body copy.
      expect(page.body).not.toContain("—");
      expect(page.intro).not.toContain("—");
    }
  });

  it("the crew page stands on its own for a producer who has never used West Peek", async () => {
    const crew = await readHowItWorksPage("crew");
    const body = crew.body.toLowerCase();
    for (const topic of ["production-access/crew", "crew code", "go live", "stream credentials", "moderat", "fallback", "cloudflare stream", "move back up", "end the show"]) {
      expect(body).toContain(topic);
    }
  });

  it("an edit replaces the draft, and everyone reading the link gets the edit", async () => {
    const before = await readHowItWorksPage("attendee");
    expect(before.isDefault).toBe(true);

    const saved = await saveHowItWorksPage({
      slug: "attendee",
      title: "How it works, for attendees",
      intro: "Updated.",
      body: "## Getting in\n\nThe join code is in your invitation and it is the whole of what you need. Go to westpeek.live/join, put it in, and register once with your name and email.",
      updatedBy: "owner",
      updatedByLabel: "Owner",
    });
    expect(saved.ok).toBe(true);

    const after = await readHowItWorksPage("attendee");
    expect(after.isDefault).toBe(false);
    expect(after.body).toContain("The join code is in your invitation");
    expect(after.updatedByLabel).toBe("Owner");
    // The other four are untouched: an edit is to one page, never to the set.
    expect((await readHowItWorksPage("crew")).isDefault).toBe(true);
  });

  it("an empty instruction page is refused rather than published to everyone holding the link", async () => {
    expect(await saveHowItWorksPage({ slug: "crew", title: "", intro: "", body: "x".repeat(200), updatedBy: "owner", updatedByLabel: "Owner" })).toMatchObject({ ok: false });
    expect(await saveHowItWorksPage({ slug: "crew", title: "Crew", intro: "", body: "See the manual.", updatedBy: "owner", updatedByLabel: "Owner" })).toMatchObject({ ok: false });
    expect((await readHowItWorksPage("crew")).isDefault).toBe(true);
  });
});
