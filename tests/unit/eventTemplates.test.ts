import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { deleteEventTemplate, listEventTemplates, saveEventTemplate, templateFromEvent } from "@/services/events/eventTemplateService";
import { templatePrefillQuery, templateSummary } from "@/types/eventTemplates";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * A template is a starting point, not a card. It lives in the runtime store, it is saved from an
 * event that worked, and every field it carries is one the create form reads — a template that
 * carried things nothing consumes would be the decoration we just removed.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("event templates", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-templates-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("refuses a nameless template and keeps the rest inside sane bounds", async () => {
    expect((await saveEventTemplate({ name: "  ", createdByLabel: "Owner" })).ok).toBe(false);
    const saved = await saveEventTemplate({ name: "Webinar 60", durationMinutes: 5000, sessions: Array.from({ length: 40 }, (_, index) => ({ title: `S${index}`, minutes: 1 })), createdByLabel: "Owner" });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.template.durationMinutes).toBe(480);
      expect(saved.template.sessions).toHaveLength(20);
      expect(saved.template.sessions[0].minutes).toBe(5);
    }
  });

  it("saves a template from a real event, carrying its shape", async () => {
    const event = await createEventRecord({ name: "Founder Office Hours", when: "later", format: "room", eventType: "community_event" }, owner);
    const result = await templateFromEvent(event.id, "Office hours", "Owner");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.template.format).toBe("room");
    expect(result.template.eventType).toBe("community_event");
    expect(result.template.sessions.length).toBeGreaterThanOrEqual(1);
    expect(result.template.registrationQuestions.length).toBeGreaterThanOrEqual(1);
    expect(result.template.description).toContain("Founder Office Hours");
  });

  it("an event created from a template gets its length and its agenda", async () => {
    const saved = await saveEventTemplate({
      name: "Three-part webinar",
      format: "stage",
      eventType: "webinar",
      durationMinutes: 60,
      sessions: [{ title: "Welcome", minutes: 10 }, { title: "Main talk", minutes: 35 }, { title: "Q&A", minutes: 15 }],
      createdByLabel: "Owner",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const event = await createEventRecord({ name: "Client Webinar", when: "now", durationMinutes: saved.template.durationMinutes, templateSessions: saved.template.sessions }, owner);
    expect(event.sessions.map((session) => session.title)).toEqual(["Welcome", "Main talk", "Q&A"]);
    const minutes = (Date.parse(event.endAt) - Date.parse(event.startAt)) / 60000;
    expect(Math.round(minutes)).toBe(60);
    // The sessions run end to end from the start.
    expect(Date.parse(event.sessions[1].startAt)).toBe(Date.parse(event.sessions[0].endAt));
  });

  it("templates list newest first and can be deleted", async () => {
    const first = await saveEventTemplate({ name: "One", createdByLabel: "Owner" });
    const second = await saveEventTemplate({ name: "Two", createdByLabel: "Owner" });
    expect((await listEventTemplates()).map((template) => template.name)).toContain("Two");
    if (first.ok) await deleteEventTemplate(first.template.id);
    // The four starter templates arrive with a clean install (starterEventTemplates.ts), so what is
    // asserted here is the owner's own two: one saved, one deleted, one left.
    const remaining = (await listEventTemplates()).filter((template) => !template.id.startsWith("template-starter-"));
    expect(remaining.map((template) => template.name)).toEqual(["Two"]);
    if (second.ok) expect(templatePrefillQuery(second.template)).toContain(`template=${second.template.id}`);
  });

  it("the page reads the store, not the seed fixtures", () => {
    const library = fs.readFileSync("components/events/EventTemplateLibrary.tsx", "utf8");
    expect(library).not.toContain("getRuntimeData");
    expect(library).toContain("listEventTemplates");
    expect(library).toContain("Use this template");
    expect(library).toContain("A template is a starting point for an event");
    expect(fs.readFileSync("app/app/events/new/page.tsx", "utf8")).toContain("getEventTemplate");
    expect(templateSummary({ id: "t", name: "n", description: "", format: "room", eventType: "webinar", durationMinutes: 45, sessions: [], registrationQuestions: [], createdByLabel: "", createdAt: "", updatedAt: "" })).toContain("Room · 45 min");
  });
});
