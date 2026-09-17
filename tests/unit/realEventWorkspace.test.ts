import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The owner opens an event SHE created and is shown her own event, or an honest "nothing here yet".
 * She opens the demo and is shown the demo's fixtures, because that is what a demo is for.
 *
 * Both halves are proven here on rendered markup, not on the read model alone: the defect she kept
 * hitting was a page confidently printing "Drake Speaker" and "87% ready" over an event that had
 * been created ninety seconds earlier.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { ensureRuntimeEvent, resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { workspaceReadiness, workspaceSegments } from "@/services/events/eventWorkspaceReadModel";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { SpeakerManager } from "@/components/speakers/SpeakerManager";
import { SponsorManager } from "@/components/sponsors/SponsorManager";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { EventOverview } from "@/components/events/EventOverview";
import { RunOfShowPage } from "@/components/run-of-show/RunOfShowPage";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

/** Every name and number the compiled demo fixtures would put on the page. */
const SEED_GIVEAWAYS = ["Drake Mensah", "Iona Adeyemi", "Clarity AI", "Northline Ventures", "Investor Panel", "Event brief approved", "Run-of-show approved"];

async function markup(node: Promise<unknown> | unknown) {
  return renderToStaticMarkup((await node) as ReactElement);
}

async function addGuest(eventId: string, role: "speaker" | "sponsor", name: string, company = "") {
  const now = new Date().toISOString();
  await getRuntimeStore().upsertSpecialGuestProfile({ guestId: `${role}-${name.toLowerCase().replaceAll(" ", "-")}`, eventId, role, name, company, title: "", createdAt: now, updatedAt: now });
}

describe("a real event's workspace shows the owner her own event", () => {
  let tempDir: string;
  let event: RuntimeEventRecord;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-real-event-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    jar.clear();
    event = await createEventRecord({ name: `Founders Breakfast ${Date.now()}`, when: "later", startAt: "2030-04-02T09:00", timezone: "America/Chicago" }, owner);
    await ensureRuntimeEvent(event.id);
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("is recognised as a real event, and the demo is not", async () => {
    expect(realRuntimeEvent(event.id)?.source).toBe("runtime");
    expect(realRuntimeEvent("event-summit")).toBeUndefined();
  });

  it("speakers: an empty event says so and names nobody", async () => {
    const html = await markup(SpeakerManager({ eventId: event.id }));
    expect(html).toContain("No speaker has arrived yet");
    expect(html).toContain("Get the speaker link");
    for (const giveaway of SEED_GIVEAWAYS) expect(html).not.toContain(giveaway);
  });

  it("speakers: the people who actually arrived are the people on the page", async () => {
    await addGuest(event.id, "speaker", "Maya Okonkwo", "Rivermark");
    const html = await markup(SpeakerManager({ eventId: event.id }));
    expect(html).toContain("Maya Okonkwo");
    expect(html).toContain("Rivermark");
    expect(html).not.toContain("No speaker has arrived yet");
    for (const giveaway of SEED_GIVEAWAYS) expect(html).not.toContain(giveaway);
  });

  it("sponsors: an empty event says so, and a sponsor with no booth is not pretended to have one", async () => {
    const empty = await markup(SponsorManager({ eventId: event.id }));
    expect(empty).toContain("No sponsor has arrived yet");
    for (const giveaway of SEED_GIVEAWAYS) expect(empty).not.toContain(giveaway);

    await addGuest(event.id, "sponsor", "Tomas Reyes", "Blue Harbor");
    const withSponsor = await markup(SponsorManager({ eventId: event.id }));
    expect(withSponsor).toContain("Blue Harbor");
    expect(withSponsor).toContain("No Booth Yet");
    expect(withSponsor).toContain("has not written their booth copy yet");
  });

  it("tasks: says plainly that there is no task list, and counts what is really outstanding", async () => {
    await addGuest(event.id, "speaker", "Maya Okonkwo");
    const html = await markup(TaskBoard({ eventId: event.id }));
    expect(html).toContain("There is no task list for a real event yet");
    expect(html).toContain("speaker tech check");
    for (const giveaway of SEED_GIVEAWAYS) expect(html).not.toContain(giveaway);
  });

  it("overview: no invented readiness percentage, and no other event's numbers", async () => {
    const html = await markup(EventOverview({ eventId: event.id }));
    expect(html).toContain(event.name);
    expect(html).toContain("of 7 ready");
    expect(html).not.toMatch(/\d+%/);
    expect(html).toContain("Nobody has entered with a role code yet");
    for (const giveaway of SEED_GIVEAWAYS) expect(html).not.toContain(giveaway);
  });

  it("run of show: the event's own sessions, and no borrowed producer cues", async () => {
    const html = await markup(RunOfShowPage({ eventId: event.id }));
    expect(html).toContain(event.name);
    expect(html).toContain("Main stage");
    expect(html).toContain("No speaker has arrived yet");
    expect(html).not.toContain("bumper");
    for (const giveaway of SEED_GIVEAWAYS) expect(html).not.toContain(giveaway);
  });

  it("readiness is counted from real rows: an empty event is not almost ready", () => {
    const segments = workspaceSegments(event);
    const items = workspaceReadiness({ event, speakers: [], sponsors: [], segments, assetsInReview: 0 });
    const ready = items.filter((item) => item.ready).map((item) => item.id);
    // Basics, a timeline, no files in review — real. Speakers and tech checks are NOT ready on an
    // event nobody has joined; the old fixture-based score called them 100%.
    expect(ready).toContain("basics");
    expect(ready).toContain("run-of-show");
    expect(ready).not.toContain("speakers");
    expect(ready).not.toContain("tech-checks");
    expect(ready).not.toContain("published");
  });
});

describe("a seed event keeps its fixtures", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-seed-event-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("the demo summit still shows its own speakers and sponsors — that is what a demo is for", async () => {
    const speakers = await markup(SpeakerManager({ eventId: "event-summit" }));
    expect(speakers).toContain("Drake Mensah");
    expect(speakers).toContain("demo event");
    expect(speakers).not.toContain("No speaker has arrived yet");

    const sponsors = await markup(SponsorManager({ eventId: "event-summit" }));
    expect(sponsors).toContain("demo event");
    expect(sponsors).not.toContain("No sponsor has arrived yet");
  });

  it("the demo's task board still lists its milestones", async () => {
    const html = await markup(TaskBoard({ eventId: "event-summit" }));
    expect(html).toContain("Event brief approved");
    expect(html).not.toContain("There is no task list for a real event yet");
  });
});
