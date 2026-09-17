import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { getEventBackupRoom, saveEventBackupRoom } from "@/services/video/backupRoomService";
import { applyStageStreamSignal, getPublicStageStreamState } from "@/services/video/stageStreamStateService";
import { ladderReadiness, rungReadiness } from "@/lib/video/fallbackReadiness";
import { parseGoogleMeetUrl, parseZoomMeetingNumber, parseZoomPasscode } from "@/types/backupRoom";
import { sendGroupEmail } from "@/services/email/groupEmailService";
import { listEventEmailLog } from "@/services/email/eventEmailService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { sha256Hex } from "@/lib/security/portableCrypto";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The bottom two rungs, set by a person.
 *
 * Until 17 Sep 2026 Zoom and Google Meet read fixed Worker variables, so on the one day they matter
 * — the feed is down mid-show and the crew is walking down the ladder — there was no way to put a
 * meeting in. What has to be true now: saving a meeting makes that rung configured and the move
 * permitted; something that is not a meeting is refused with a reason a person can act on; the
 * attendee's next poll carries the new value with no reload; and moving back up clears it.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };
const MEET = "https://meet.google.com/abc-defg-hij";

async function addAttendee(eventId: string, email: string, name: string) {
  const now = new Date().toISOString();
  const profile: AttendeeProfile = {
    attendeeId: `att-${name.toLowerCase()}`,
    eventId,
    emailHash: await sha256Hex(email),
    email,
    name,
    company: "Analytical Engines",
    title: "Engineer",
    socialLinks: [],
    topicsOfInterest: [],
    networkingOptIn: true,
    role: "attendee",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await getRuntimeStore().upsertAttendeeProfile(profile);
}

describe("configurable backup rooms", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-backup-rooms-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    // No house room in the environment: every rung below is turned on by a save, not by a deploy.
    delete process.env.TIER4_ZOOM_MEETING_NUMBER;
    delete process.env.ZOOM_MEETING_NUMBER;
    delete process.env.GOOGLE_MEET_MANAGED_FALLBACK_URL;
    delete process.env.GOOGLE_MEET_EMERGENCY_URL;
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "Backup Rooms Summit", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a rung with no meeting on it reads not configured, and the reason names what is missing", async () => {
    const backup = await getEventBackupRoom(eventId);
    const rungs = ladderReadiness(process.env, backup);
    const zoom = rungs.find((rung) => rung.source === "ZOOM")!;
    const meet = rungs.find((rung) => rung.source === "GOOGLE_MEET")!;
    expect(zoom.ready).toBe(false);
    expect(zoom.reason).toContain("Zoom meeting number");
    expect(meet.ready).toBe(false);
    expect(meet.reason).toContain("Google Meet link");
  });

  it("saving a Zoom meeting makes that rung configured, and the move down is permitted", async () => {
    const saved = await saveEventBackupRoom({ eventId, zoomMeetingNumber: "878 1234 5678", zoomPasscode: "letmein", savedBy: "crew:producer" });
    expect(saved.ok).toBe(true);
    // Stored the way Zoom's SDK wants it: digits, no spaces.
    expect(saved.record?.zoomMeetingNumber).toBe("87812345678");

    const backup = await getEventBackupRoom(eventId);
    expect(rungReadiness("ZOOM", process.env, backup)).toMatchObject({ ready: true, reason: "" });
    // Meet is a separate rung and is still off: one save does not turn the other one on.
    expect(rungReadiness("GOOGLE_MEET", process.env, backup).ready).toBe(false);
  });

  it("an invalid meeting number is refused with a readable reason, and nothing is stored", async () => {
    const tooShort = await saveEventBackupRoom({ eventId, zoomMeetingNumber: "1234", savedBy: "owner" });
    expect(tooShort.ok).toBe(false);
    expect(tooShort.reason).toContain("9, 10 or 11 digits");
    const words = await saveEventBackupRoom({ eventId, zoomMeetingNumber: "join my zoom", savedBy: "owner" });
    expect(words.ok).toBe(false);
    expect(words.reason).toContain("only digits");
    // A refused save leaves the rung exactly as it was: not configured, not half-written.
    expect((await getEventBackupRoom(eventId)).zoomMeetingNumber).toBeUndefined();
    expect(rungReadiness("ZOOM", process.env, await getEventBackupRoom(eventId)).ready).toBe(false);
  });

  it("reads a meeting number out of a pasted join link, and refuses a Zoom link in the Meet box", async () => {
    expect(parseZoomMeetingNumber("https://us02web.zoom.us/j/87812345678?pwd=abc")).toMatchObject({ ok: true, value: "87812345678" });
    expect(parseZoomMeetingNumber("878-1234-5678")).toMatchObject({ ok: true, value: "87812345678" });
    expect(parseZoomMeetingNumber("")).toMatchObject({ ok: true, value: undefined });
    expect(parseZoomPasscode("waytoolongpasscode").ok).toBe(false);

    expect(parseGoogleMeetUrl(MEET)).toMatchObject({ ok: true, value: MEET });
    expect(parseGoogleMeetUrl("meet.google.com/abc-defg-hij")).toMatchObject({ ok: true, value: MEET });
    const wrongHost = parseGoogleMeetUrl("https://us02web.zoom.us/j/87812345678");
    expect(wrongHost.ok).toBe(false);
    expect(wrongHost.reason).toContain("meet.google.com");
    const noRoom = parseGoogleMeetUrl("https://meet.google.com/");
    expect(noRoom.ok).toBe(false);
    expect(noRoom.reason).toContain("three-part code");
  });

  it("a meeting saved mid-show reaches the attendee's next poll, with no reload for anyone", async () => {
    await applyStageStreamSignal({ eventId, signal: "manual_switch_to_zoom", reason: "Daily failed." });
    // The crew types the meeting in AFTER the room has already moved, which is the real sequence.
    await saveEventBackupRoom({ eventId, zoomMeetingNumber: "87812345678", zoomPasscode: "1234", savedBy: "crew:producer" });
    const state = await getPublicStageStreamState(eventId);
    expect(state.activeStreamSource).toBe("ZOOM");
    expect(state.zoomMeetingNumber).toBe("87812345678");
    expect(state.zoomMeetingPasscode).toBe("1234");
  });

  it("moving down to Meet carries the link the crew saved, and moving back up clears it", async () => {
    await saveEventBackupRoom({ eventId, googleMeetUrl: MEET, savedBy: "owner" });
    const moved = await applyStageStreamSignal({ eventId, signal: "manual_switch_to_google_meet", reason: "Zoom failed." });
    expect(moved.activeStreamSource).toBe("GOOGLE_MEET");
    const onMeet = await getPublicStageStreamState(eventId);
    expect(onMeet.activeStreamSource).toBe("GOOGLE_MEET");
    expect(onMeet.googleMeetFallbackUrl).toBe(MEET);

    await applyStageStreamSignal({ eventId, signal: "operator_rollback_to_livekit", reason: "Primary recovered." });
    const back = await getPublicStageStreamState(eventId);
    // The attendee is back on the venue stage, so the moved-to-Meet panel has nothing to render.
    expect(back.activeStreamSource).toBe("LIVEKIT_INGRESS");
    expect(rungReadiness("GOOGLE_MEET", process.env, await getEventBackupRoom(eventId)).ready).toBe(true);
  });

  it("the new Meet link reaches the people who are not looking: one row per recipient, and only on a press", async () => {
    await saveEventBackupRoom({ eventId, googleMeetUrl: MEET, savedBy: "owner" });
    await addAttendee(eventId, "ada@example.com", "Ada");
    await addAttendee(eventId, "cal@realco.io", "Cal");
    await applyStageStreamSignal({ eventId, signal: "manual_switch_to_google_meet", reason: "Zoom failed." });

    // Moving down sends nothing by itself. The crew card offers a LINK to the composer; this is what
    // happens when a person presses Send there, and nothing happens until they do.
    expect(await listEventEmailLog(eventId)).toHaveLength(0);

    const result = await sendGroupEmail({
      eventId,
      audience: "attendees",
      subject: "We have moved Backup Rooms Summit to a Google Meet room",
      body: `Join here: ${MEET}`,
      sentBy: "crew:producer",
    });
    expect(result.ok).toBe(true);
    const rows = await listEventEmailLog(eventId);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.recipientEmail).sort()).toEqual(["ada@example.com", "cal@realco.io"]);
    // The link they are being sent is the one the ladder is actually on.
    expect((await getPublicStageStreamState(eventId)).googleMeetFallbackUrl).toBe(MEET);
  });

  it("clearing a field turns that rung back off, and Reset primary does not throw the meeting away", async () => {
    await saveEventBackupRoom({ eventId, zoomMeetingNumber: "87812345678", googleMeetUrl: MEET, savedBy: "owner" });
    await applyStageStreamSignal({ eventId, signal: "operator_reset_primary", reason: "Back to the top." });
    const afterReset = await getPublicStageStreamState(eventId);
    expect(afterReset.zoomMeetingNumber).toBe("87812345678");
    expect(afterReset.googleMeetFallbackUrl).toBe(MEET);

    await saveEventBackupRoom({ eventId, zoomMeetingNumber: "", googleMeetUrl: MEET, savedBy: "owner" });
    const backup = await getEventBackupRoom(eventId);
    expect(backup.zoomMeetingNumber).toBeUndefined();
    // The passcode goes with the meeting it belonged to rather than lingering on an empty rung.
    expect(backup.zoomPasscode).toBeUndefined();
    expect(rungReadiness("ZOOM", process.env, backup).ready).toBe(false);
    expect(rungReadiness("GOOGLE_MEET", process.env, backup).ready).toBe(true);
  });
});
