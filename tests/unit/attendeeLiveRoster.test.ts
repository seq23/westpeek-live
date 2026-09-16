import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The attendee roster and one-click decisions. Before this existed the crew typed an
 * attendee id copied out of the fallback event log into a form on the testing console.
 * Under test: the pure decision ordering (request → approve / decline; revoke closes a
 * request; permit un-revokes without granting publish), the roster join (registered
 * profiles × capability × silence × last chat; pending requests oldest first; search;
 * bounded), and that every crew decision is refused without a crew/operator/owner cookie.
 */

const control = vi.fn<(eventId?: string) => Promise<{ ok: true; actorRole: "crew" | "operator" | "owner" } | { ok: false; error: string }>>();
vi.mock("@/lib/auth/liveControlRequestGuard", () => ({ requireLiveEventControlAccessForRequest: (eventId?: string) => control(eventId) }));
const identity = vi.fn<() => Promise<{ attendeeId: string; displayName: string; company: string; title: string; role: "attendee" } | undefined>>();
vi.mock("@/services/attendees/attendeeSessionService", () => ({ getCurrentAttendeeIdentity: () => identity() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const removed: string[] = [];
vi.mock("@/services/video/livekitParticipantAdmin", () => ({ removeLiveKitParticipantFromMainStage: async (input: { attendeeId: string }) => { removed.push(input.attendeeId); return { status: "removed" }; } }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { decideCapability, getAttendeeLiveCapability, requestedCapability } from "@/services/venue/attendeeLivePermissionService";
import { getAttendeeRoster, liveStatusOf, ROSTER_LIMIT } from "@/services/venue/attendeeRosterService";
import { decideAttendeeLiveAccess, requestAttendeeStageAccess } from "@/lib/actions/attendeeLiveActions";
import { postLiveRoomChatMessage, setLiveChatAttendeeSilence } from "@/services/venue/liveChatService";
import type { AttendeeProfile } from "@/types/attendeeRegistration";

const EVENT = "event-roster-test";
const room = { eventId: EVENT, roomKind: "main_stage" as const, roomId: "main-stage" };

function profile(attendeeId: string, name: string, company: string, createdAt: string): AttendeeProfile {
  return { attendeeId, eventId: EVENT, emailHash: `hash-${attendeeId}`, name, emailMasked: `${name.slice(0, 1).toLowerCase()}***@example.com`, company, title: "Founder", socialLinks: [], topicsOfInterest: [], networkingOptIn: false, role: "attendee", status: "active", createdAt, updatedAt: createdAt };
}

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("attendee live decisions (pure)", () => {
  it("a request is pending, approve grants camera + mic + join and closes it, decline closes it without granting", () => {
    const requested = requestedCapability(undefined, { ...room, attendeeId: "a" });
    expect(requested).toMatchObject({ requestStatus: "requested", canJoinLiveStream: false, approvedForStage: false, revoked: false });
    expect(liveStatusOf(requested)).toBe("requested");

    const approved = decideCapability(requested, { ...room, attendeeId: "a", decision: "approve_publish", actorRole: "crew" });
    expect(approved).toMatchObject({ requestStatus: "approved", canJoinLiveStream: true, canPublishCamera: true, canPublishMicrophone: true, approvedForStage: true, revoked: false, updatedBy: "crew" });
    expect(liveStatusOf(approved)).toBe("approved_to_publish");

    const declined = decideCapability(requested, { ...room, attendeeId: "a", decision: "decline", actorRole: "crew" });
    expect(declined).toMatchObject({ requestStatus: "declined", canJoinLiveStream: false, approvedForStage: false, revoked: false });
    expect(liveStatusOf(declined)).toBe("declined");
    // A new request supersedes the decline.
    expect(requestedCapability(declined, { ...room, attendeeId: "a" })).toMatchObject({ requestStatus: "requested", decidedAt: undefined });
  });

  it("permit only grants watching and un-revokes; revoke strips everything and closes a pending request", () => {
    const permitted = decideCapability(undefined, { ...room, attendeeId: "b", decision: "permit", actorRole: "owner" });
    expect(permitted).toMatchObject({ canJoinLiveStream: true, approvedForStage: false, canPublishCamera: false, revoked: false });
    expect(liveStatusOf(permitted)).toBe("permitted");

    const approved = decideCapability(permitted, { ...room, attendeeId: "b", decision: "approve_publish", actorRole: "owner" });
    const revoked = decideCapability(approved, { ...room, attendeeId: "b", decision: "revoke", actorRole: "operator", reason: "Off-topic" });
    expect(revoked).toMatchObject({ canJoinLiveStream: false, canPublishCamera: false, canPublishMicrophone: false, approvedForStage: false, revoked: true, revokedReason: "Off-topic" });
    expect(liveStatusOf(revoked)).toBe("revoked");

    const rePermitted = decideCapability(revoked, { ...room, attendeeId: "b", decision: "permit", actorRole: "operator" });
    expect(rePermitted).toMatchObject({ canJoinLiveStream: true, revoked: false, revokedReason: undefined, approvedForStage: false });

    const pending = requestedCapability(undefined, { ...room, attendeeId: "c" });
    expect(decideCapability(pending, { ...room, attendeeId: "c", decision: "revoke", actorRole: "crew" })).toMatchObject({ revoked: true, requestStatus: "declined" });

    const reset = decideCapability(revoked, { ...room, attendeeId: "b", decision: "reset", actorRole: "crew" });
    expect(reset).toMatchObject({ canJoinLiveStream: false, approvedForStage: false, revoked: false, updatedBy: "crew" });
    expect(reset.requestStatus).toBeUndefined();
    expect(liveStatusOf(reset)).toBe("open");
  });
});

describe("attendee roster and pending requests (store-backed)", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-roster-"));
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    control.mockReset();
    identity.mockReset();
    removed.length = 0;
    control.mockResolvedValue({ ok: true, actorRole: "crew" });
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("lists registered attendees newest first with live status, silence, and last chat; pending requests oldest first", async () => {
    const store = getRuntimeStore();
    await store.upsertAttendeeProfile(profile("att-1", "Ada Lovelace", "Analytical", "2026-09-16T01:00:00.000Z"));
    await store.upsertAttendeeProfile(profile("att-2", "Grace Hopper", "Navy", "2026-09-16T02:00:00.000Z"));
    await store.upsertAttendeeProfile(profile("att-3", "Linus T", "Kernel", "2026-09-16T03:00:00.000Z"));
    await store.upsertAttendeeProfile({ ...profile("att-x", "Gone", "Revoked Co", "2026-09-16T04:00:00.000Z"), status: "revoked" });

    identity.mockResolvedValue({ attendeeId: "att-2", displayName: "Grace Hopper", company: "Navy", title: "Founder", role: "attendee" });
    await requestAttendeeStageAccess(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    identity.mockResolvedValue({ attendeeId: "att-1", displayName: "Ada Lovelace", company: "Analytical", title: "Founder", role: "attendee" });
    await requestAttendeeStageAccess(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage" }));
    expect((await postLiveRoomChatMessage({ ...room, attendeeId: "att-3", displayName: "Linus T", message: "hi" })).ok).toBe(true);
    await setLiveChatAttendeeSilence({ ...room, attendeeId: "att-3", silenced: true, actorRole: "crew" });

    const roster = await getAttendeeRoster({ eventId: EVENT });
    expect(roster.total).toBe(3);
    expect(roster.rows.map((row) => row.attendeeId)).toEqual(["att-3", "att-2", "att-1"]);
    expect(roster.rows.find((row) => row.attendeeId === "att-3")).toMatchObject({ silenced: true, liveStatus: "open", name: "Linus T", company: "Kernel" });
    expect(roster.rows.find((row) => row.attendeeId === "att-3")?.lastChatAt).toBeTruthy();
    expect(roster.rows.find((row) => row.attendeeId === "att-2")).toMatchObject({ liveStatus: "requested", silenced: false });
    expect(roster.pending.map((row) => row.attendeeId)).toEqual(["att-2", "att-1"]);

    const search = await getAttendeeRoster({ eventId: EVENT, search: "hopper" });
    expect(search.rows.map((row) => row.attendeeId)).toEqual(["att-2"]);
    expect(search.total).toBe(3);
    expect(search.pending).toHaveLength(2);
  });

  it("approve from the pending queue grants the stage and clears the queue; decline clears it without granting; revoke drops the LiveKit participant", async () => {
    const store = getRuntimeStore();
    await store.upsertAttendeeProfile(profile("att-1", "Ada Lovelace", "Analytical", "2026-09-16T01:00:00.000Z"));
    await store.upsertAttendeeProfile(profile("att-2", "Grace Hopper", "Navy", "2026-09-16T02:00:00.000Z"));
    for (const attendeeId of ["att-1", "att-2"]) {
      identity.mockResolvedValue({ attendeeId, displayName: attendeeId, company: "x", title: "y", role: "attendee" });
      await requestAttendeeStageAccess(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage" }));
    }
    await decideAttendeeLiveAccess(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", attendeeId: "att-1", decision: "approve_publish" }));
    await decideAttendeeLiveAccess(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", attendeeId: "att-2", decision: "decline" }));
    const roster = await getAttendeeRoster({ eventId: EVENT });
    expect(roster.pending).toHaveLength(0);
    expect(roster.rows.find((row) => row.attendeeId === "att-1")?.liveStatus).toBe("approved_to_publish");
    expect(roster.rows.find((row) => row.attendeeId === "att-2")?.liveStatus).toBe("declined");
    expect(await getAttendeeLiveCapability(EVENT, "main_stage", "main-stage", "att-1")).toMatchObject({ approvedForStage: true, canPublishCamera: true, canPublishMicrophone: true, updatedBy: "crew" });

    await decideAttendeeLiveAccess(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", attendeeId: "att-1", decision: "revoke", reason: "Time's up" }));
    // decline dropped att-2 from the room too (any decision that takes publishing away does); revoke drops att-1.
    expect(removed).toEqual(["att-2", "att-1"]);
    expect((await getAttendeeRoster({ eventId: EVENT })).rows.find((row) => row.attendeeId === "att-1")).toMatchObject({ liveStatus: "revoked" });
  });

  it("refuses every decision without a crew, operator, or owner cookie", async () => {
    await getRuntimeStore().upsertAttendeeProfile(profile("att-1", "Ada Lovelace", "Analytical", "2026-09-16T01:00:00.000Z"));
    control.mockResolvedValue({ ok: false, error: "Owner, showrunner/operator, or crew access required." });
    for (const decision of ["permit", "approve_publish", "revoke", "decline", "reset"]) {
      await expect(decideAttendeeLiveAccess(form({ eventId: EVENT, attendeeId: "att-1", decision }))).rejects.toThrow(/crew access required/);
    }
    expect(await getAttendeeLiveCapability(EVENT, "main_stage", "main-stage", "att-1")).toBeUndefined();
    expect(removed).toEqual([]);
  });

  it("is bounded to the latest 200 registrations", async () => {
    const store = getRuntimeStore();
    for (let index = 0; index < ROSTER_LIMIT + 5; index += 1) await store.upsertAttendeeProfile(profile(`att-${index}`, `Person ${index}`, "Co", new Date(Date.UTC(2026, 8, 16, 0, 0, index)).toISOString()));
    const roster = await getAttendeeRoster({ eventId: EVENT });
    expect(roster.rows).toHaveLength(ROSTER_LIMIT);
    expect(roster.rows[0].attendeeId).toBe(`att-${ROSTER_LIMIT + 4}`);
  });
});
