import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { deleteEventTemplate, getEventTemplate, installStarterTemplatesOnce, listEventTemplates } from "@/services/events/eventTemplateService";
import { STARTER_EVENT_TEMPLATES, starterTemplateLengthMismatches } from "@/services/events/starterEventTemplates";
import { getHouseDefaults, saveHouseDefaults } from "@/services/agencies/houseDefaultsService";
import { renderWestPeekDocument, WEST_PEEK_DOCUMENTS } from "@/services/documents/westPeekDocuments";
import { saveHowItWorksPage } from "@/services/content/howItWorksService";
import { MANUAL_WORKFLOWS } from "@/services/email/eventEmailService";
import { findAccessCodeShape } from "@/lib/manual/accessCodeShapes";
import { attendeeSessionDaysFor } from "@/services/attendees/attendeeSessionPolicy";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The five things the owner hit, proved rather than asserted about in comments: the shelf ships
 * stocked with rows she owns, the house defaults actually reach a new event, the instruction
 * downloads are built from the live page, and the manual download refuses to carry a code.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("the shelf, the Email tab, the documents and the house defaults", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-shelf-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("the starter templates install once and a deleted one stays deleted", async () => {
    const first = await listEventTemplates();
    expect(first).toHaveLength(STARTER_EVENT_TEMPLATES.length);
    expect(first.map((template) => template.name).sort()).toEqual(["45-minute workshop", "Client webinar", "Demo day", "West Peek Room"]);

    // They are ordinary rows: delete one, and no amount of reading the page brings it back.
    await deleteEventTemplate("template-starter-demo-day");
    expect(await listEventTemplates()).toHaveLength(STARTER_EVENT_TEMPLATES.length - 1);
    await installStarterTemplatesOnce();
    expect(await getEventTemplate("template-starter-demo-day")).toBeUndefined();
    expect((await listEventTemplates()).map((template) => template.id)).not.toContain("template-starter-demo-day");
  });

  it("a starter template's agenda adds up to the length it advertises", () => {
    expect(starterTemplateLengthMismatches().map((template) => template.name)).toEqual([]);
  });

  it("a starter template carries everything the create form reads, end to end", async () => {
    const templates = await listEventTemplates();
    const webinar = templates.find((template) => template.id === "template-starter-client-webinar");
    expect(webinar).toBeDefined();
    if (!webinar) return;
    expect(webinar.durationMinutes).toBe(75);
    expect(webinar.sessions).toHaveLength(4);
    expect(webinar.registrationQuestions.length).toBeGreaterThan(0);

    // The same path /app/events/new takes when ?template= is set.
    const event = await createEventRecord({
      name: "Lumen Webinar",
      when: "later",
      startAt: "2027-02-01T10:00",
      format: webinar.format,
      eventType: webinar.eventType,
      durationMinutes: webinar.durationMinutes,
      templateSessions: webinar.sessions,
    }, owner);
    const minutes = Math.round((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000);
    expect(minutes).toBe(75);
    expect(event.sessions).toHaveLength(4);
    expect(event.sessions[0].title).toBe("Welcome and housekeeping");
  });

  it("a changed house default reaches a newly created event", async () => {
    const before = await getHouseDefaults();
    expect(before.defaultTimezone).toBe("America/Chicago");

    const saved = await saveHouseDefaults({
      fromEmail: "shows@events.westpeek.live",
      replyToEmail: "hello@westpeek.live",
      defaultTimezone: "America/New_York",
      defaultNetworkingMatchMinutes: 7,
      defaultAttendeeSessionDays: 30,
      defaultRegistrationQuestions: [{ key: "whyHere", label: "Why are you here", type: "textarea", required: false }],
      livekitTier: "scale",
    }, owner);
    expect(saved.ok).toBe(true);

    const event = await createEventRecord({ name: "House Inherits", when: "later", startAt: "2027-03-01T09:00" }, owner);
    expect(event.timezone).toBe("America/New_York");
    expect(event.attendeeSessionDays).toBe(30);
    expect(event.registrationQuestions?.map((question) => question.label)).toEqual(["Why are you here"]);
    expect(await attendeeSessionDaysFor(event.id)).toBe(30);

    const after = await getHouseDefaults();
    expect(after.livekitTier).toBe("scale");
    expect(after.defaultNetworkingMatchMinutes).toBe(7);
    // An ordinary save does not disturb the starter-template install stamp, so saving a setting
    // never brings back a starter the owner deleted.
    await listEventTemplates();
    const stamped = await getHouseDefaults();
    expect(stamped.starterTemplatesInstalledAt).not.toBe("");
    const resaved = await saveHouseDefaults({
      fromEmail: stamped.fromEmail, replyToEmail: stamped.replyToEmail, defaultTimezone: stamped.defaultTimezone,
      defaultNetworkingMatchMinutes: stamped.defaultNetworkingMatchMinutes, defaultAttendeeSessionDays: stamped.defaultAttendeeSessionDays,
      defaultRegistrationQuestions: stamped.defaultRegistrationQuestions, livekitTier: stamped.livekitTier,
    }, owner);
    expect(resaved.ok).toBe(true);
    expect((await getHouseDefaults()).starterTemplatesInstalledAt).toBe(stamped.starterTemplatesInstalledAt);
  });

  it("refuses a from address that is not an address, and a timezone the runtime does not know", async () => {
    const bad = await saveHouseDefaults({
      fromEmail: "not-an-address", replyToEmail: "hello@westpeek.live", defaultTimezone: "America/Chicago",
      defaultNetworkingMatchMinutes: 4, defaultAttendeeSessionDays: 14, defaultRegistrationQuestions: [], livekitTier: "",
    }, owner);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toContain("real address");

    const badZone = await saveHouseDefaults({
      fromEmail: "shows@events.westpeek.live", replyToEmail: "hello@westpeek.live", defaultTimezone: "Mars/Olympus",
      defaultNetworkingMatchMinutes: 4, defaultAttendeeSessionDays: 14, defaultRegistrationQuestions: [], livekitTier: "",
    }, owner);
    expect(badZone.ok).toBe(false);
    if (!badZone.ok) expect(badZone.reason).toContain("Mars/Olympus");
  });

  it("an instruction page download is built from the live content", async () => {
    const before = await renderWestPeekDocument("how-it-works-crew");
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.markdown).not.toContain("The green room opens ninety minutes before doors");

    await saveHowItWorksPage({
      slug: "crew",
      title: "How it works, for crew",
      intro: "Read this before you are on.",
      body: "## Call time\n\nThe green room opens ninety minutes before doors and we do not start the check late. Bring the deck, bring the timings, and say something if a speaker has not arrived by the half.",
      updatedBy: "owner",
      updatedByLabel: "Owner",
    });

    const after = await renderWestPeekDocument("how-it-works-crew");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.markdown).toContain("The green room opens ninety minutes before doors");
    expect(after.markdown).toContain("/how-it-works/crew");
  });

  it("the documents are the manual and the five instruction pages, and none of them is an asset", async () => {
    expect(WEST_PEEK_DOCUMENTS.map((document) => document.id)).toEqual([
      "operator-manual",
      "how-it-works-client",
      "how-it-works-crew",
      "how-it-works-speaker",
      "how-it-works-sponsor",
      "how-it-works-attendee",
    ]);
    for (const document of WEST_PEEK_DOCUMENTS) expect(document.fileName.endsWith(".md")).toBe(true);
    expect((await renderWestPeekDocument("not-a-document")).ok).toBe(false);
  });

  it("the manual download runs the same access-code check the manual validator runs", async () => {
    const rendered = await renderWestPeekDocument("operator-manual");
    expect(rendered.ok).toBe(true);
    if (rendered.ok) expect(findAccessCodeShape(rendered.markdown)).toBeUndefined();
    // And the check is not a no-op: a real code is caught, the manual's worked example is not.
    expect(findAccessCodeShape("Your code is WPL-7Q2XKD.")).toBe("WPL-7Q2XKD");
    expect(findAccessCodeShape("The stem becomes WPL-45MINU in the worked example.")).toBeUndefined();
    expect(findAccessCodeShape("OWNER_PASSWORD: hunter2")).toBe("a password value");
  });

  it("the crew call sheet is a workflow the Email tab and the event page can both send", () => {
    expect(MANUAL_WORKFLOWS).toHaveLength(8);
    const crew = MANUAL_WORKFLOWS.find((entry) => entry.workflow === "crew_call_sheet");
    expect(crew).toBeDefined();
    expect(crew?.whoItIsFor).toBe("The crew");
  });
});
