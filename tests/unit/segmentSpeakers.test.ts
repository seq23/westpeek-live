import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { ensureRuntimeEvent, resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, updateEventRecord } from "@/services/events/eventRepository";
import { getEventShow, segmentIdForSession, segmentsForSpeaker, showSegmentsFor, whoIsOn } from "@/services/run-of-show/eventShow";
import { getRunOfShowForEvent } from "@/lib/runtime/getRuntimeData";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * Each segment records who is on (30 Oct 2026). Before, no segment did, and a created event's
 * speaker id was always the empty string.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("segment speakers", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-segment-people-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "People Summit", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("an event saved before segments named people renders as nobody named, not as an error", async () => {
    await ensureRuntimeEvent(eventId);
    const segments = showSegmentsFor(eventId, new Map());
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(segment.speakerIds).toEqual([]);
      expect(segment.speakers).toEqual([]);
      expect(whoIsOn(segment)).toBe("");
    }
  });

  it("stores speakers, host, also-on and cue notes per segment, and every reader sees them by name", async () => {
    const event = (await ensureRuntimeEvent(eventId))!;
    const now = new Date().toISOString();
    const speaker = await getRuntimeStore().upsertSpecialGuestProfile({ guestId: "speaker-amara", eventId, role: "speaker", name: "Dr. Amara Okafor", company: "Nova", title: "Partner", createdAt: now, updatedAt: now });
    const [first, ...rest] = event.sessions;
    await updateEventRecord(eventId, { sessions: [{ ...first, speakerIds: [speaker.guestId], host: "Priya", alsoOn: "Jordan Ellis", cueNotes: "Roll the sting" }, ...rest] }, owner);
    await ensureRuntimeEvent(eventId);

    const show = await getEventShow(eventId);
    const segment = show.segments.find((run) => run.segment.sessionId === first.id)!.segment;
    expect(segment.id).toBe(segmentIdForSession(first.id));
    expect(segment.speakers).toEqual([{ id: speaker.guestId, name: "Dr. Amara Okafor" }]);
    expect(segment.host).toBe("Priya");
    expect(segment.cueNotes).toBe("Roll the sting");
    expect(whoIsOn(segment)).toBe("Dr. Amara Okafor, Jordan Ellis · host Priya");
    // The speaker portal's "you're on at" reads the same thing.
    expect(segmentsForSpeaker(show, speaker.guestId).map((run) => run.segment.sessionId)).toEqual([first.id]);
    expect(segmentsForSpeaker(show, "someone-else")).toEqual([]);
    // And a created event's run-of-show speaker id is no longer always empty.
    expect(getRunOfShowForEvent(eventId).find((row) => row.id === segmentIdForSession(first.id))?.speakerId).toBe(speaker.guestId);
  });

  it("a speaker id that is not a known speaker is not printed as a raw id", async () => {
    const event = (await ensureRuntimeEvent(eventId))!;
    await updateEventRecord(eventId, { sessions: event.sessions.map((session) => ({ ...session, speakerIds: ["guest-abc123"] })) }, owner);
    await ensureRuntimeEvent(eventId);
    const show = await getEventShow(eventId);
    expect(show.segments.every((run) => run.segment.speakers.length === 0)).toBe(true);
    expect(JSON.stringify(show.segments.map((run) => whoIsOn(run.segment)))).not.toContain("guest-abc123");
  });
});
