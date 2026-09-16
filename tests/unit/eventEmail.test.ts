import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { lastSendByWorkflow, listAllEmailLog, listEventEmailLog, MANUAL_WORKFLOWS, parseRecipients, sendManualWorkflow } from "@/services/email/eventEmailService";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * Email that tells the truth: a send writes a row saying who it went to, which provider carried it
 * and whether it landed; the page reads those rows instead of printing a slogan; and nothing sends
 * without a person naming recipients.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("event email", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-email-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "Email Room", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("reads a recipient list the way a person types one", () => {
    expect(parseRecipients("Ada@Example.com, cal@realco.io; ada@example.com\nnonsense")).toEqual(["ada@example.com", "cal@realco.io"]);
    expect(parseRecipients("")).toEqual([]);
  });

  it("refuses to send to nobody, and refuses a workflow no person sends by hand", async () => {
    const none = await sendManualWorkflow({ eventId, workflow: "speaker_invite", recipients: [], sentBy: "owner" });
    expect(none.ok).toBe(false);
    expect(none.reason).toContain("at least one email");
    const automatic = await sendManualWorkflow({ eventId, workflow: "testing_failure_alert", recipients: ["ada@example.com"], sentBy: "owner" });
    expect(automatic.ok).toBe(false);
    expect(await listEventEmailLog(eventId)).toHaveLength(0);
  });

  it("a send writes one row per recipient, naming the provider and who sent it", async () => {
    const result = await sendManualWorkflow({ eventId, workflow: "speaker_invite", recipients: ["ada@example.com", "cal@realco.io"], message: "Green room opens at 9.", sentBy: "crew:producer" });
    expect(result.sent).toBe(2);
    const log = await listEventEmailLog(eventId);
    expect(log).toHaveLength(2);
    expect(log.every((row) => row.sentBy === "crew:producer")).toBe(true);
    expect(log.every((row) => row.eventId === eventId)).toBe(true);
    // Without Resend configured the rows say mock rather than pretending something was delivered.
    expect(log.every((row) => row.provider === "mock" || row.provider === "resend")).toBe(true);
    const latest = await lastSendByWorkflow(eventId);
    expect(latest.get("speaker_invite")?.recipientEmail).toBeTruthy();
    expect(latest.get("show_day_reminder")).toBeUndefined();
  });

  it("the cross-event view sees every event's messages", async () => {
    const second = (await createEventRecord({ name: "Second Email Room", when: "now" }, owner)).id;
    await sendManualWorkflow({ eventId, workflow: "client_invite", recipients: ["client@example.com"], sentBy: "owner" });
    await sendManualWorkflow({ eventId: second, workflow: "report_ready", recipients: ["client@example.com"], sentBy: "owner" });
    const all = await listAllEmailLog();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((row) => row.eventId))).toEqual(new Set([eventId, second]));
  });

  it("every manual workflow says who it is for and what it says", () => {
    expect(MANUAL_WORKFLOWS.length).toBeGreaterThanOrEqual(6);
    for (const entry of MANUAL_WORKFLOWS) {
      expect(entry.label.length).toBeGreaterThan(3);
      expect(entry.whoItIsFor.length).toBeGreaterThan(2);
      expect(entry.gist.length).toBeGreaterThan(10);
    }
  });

  it("the page reads the log instead of printing the old slogan", () => {
    expect(fs.existsSync("components/email/EmailWorkflowMatrix.tsx")).toBe(false);
    const center = fs.readFileSync("components/email/EventEmailCenter.tsx", "utf8");
    expect(center).not.toContain("Live-send capable through Resend");
    expect(center).toContain("lastSendByWorkflow");
    expect(center).toContain("listEventEmailLog");
  });
});
