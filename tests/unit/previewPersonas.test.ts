import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests, getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { registerOrUpdateAttendee } from "@/services/attendees/attendeeRegistrationService";
import { postLiveRoomChatMessage } from "@/services/venue/liveChatService";
import { recordAttendeeStageRequest, setAttendeeLiveCapability } from "@/services/venue/attendeeLivePermissionService";
import { upsertAttendeeAgendaIntent } from "@/services/attendees/attendeeAgendaIntentService";
import { joinNetworkingQueue } from "@/services/speed-networking/speedNetworkingService";
import { buildHelpRequestDraft } from "@/services/venue/helpRequestService";
import { registerGuestIdentity } from "@/services/guests/guestIdentityService";
import { getAttendeeRoster } from "@/services/venue/attendeeRosterService";
import { filterNetworkingOptIn, searchPeople } from "@/services/venue/peopleDirectoryService";
import { PREVIEW_PERSONAS, excludePreviewIdentities, isPreviewIdentity, previewMirrorId, previewPersona, refusePreviewWrite } from "@/lib/auth/previewIdentity";
import { canViewAsGuest, isViewAsPath } from "@/lib/auth/viewAsGuard";
import { canViewAsAccessPath } from "@/lib/auth/v5RouteAuthorization";
import { diagnoseAttendee } from "@/services/venue/attendeeDiagnosticsService";
import { describeClient } from "@/services/venue/attendeeClientHeartbeatService";
import type { LiveKitRoomSnapshot } from "@/services/video/livekitParticipantService";
import type { V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import type { AttendeeSession } from "@/types/attendeeSession";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * A preview persona renders the event's real page and writes NOTHING. These tests call the services
 * directly — not the pages, not the actions — because a refusal that only exists in the UI is not a
 * refusal: a stale page, a replayed form or a hand-made request would write anyway.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("preview personas cannot write", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-preview-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "Preview Room", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("every persona id, and a mirror id, is recognised as a preview identity", () => {
    for (const persona of PREVIEW_PERSONAS) expect(isPreviewIdentity(persona.id), persona.id).toBe(true);
    expect(isPreviewIdentity(previewMirrorId("attendee-7"))).toBe(true);
    // A real guest id and a real attendee id are NOT previews; refusing them would break the app.
    for (const real of ["guest-abc", "attendee-7", "", undefined, "previewer-jones", "mirrors"]) expect(isPreviewIdentity(real), String(real)).toBe(false);
  });

  it("chat, hand-raise, capability, registration, agenda, networking, help and guest identity all refuse a persona", async () => {
    for (const persona of PREVIEW_PERSONAS) {
      await expect(postLiveRoomChatMessage({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: persona.id, displayName: persona.name, message: "hello room" })).rejects.toThrow(/preview/i);
      await expect(recordAttendeeStageRequest({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: persona.id })).rejects.toThrow(/preview/i);
      await expect(setAttendeeLiveCapability({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: persona.id, canJoinLiveStream: true, canPublishCamera: false, canPublishMicrophone: false, canShareScreen: false, approvedForStage: false, revoked: false, updatedAt: new Date().toISOString() })).rejects.toThrow(/preview/i);
      await expect(registerOrUpdateAttendee({ eventId, name: "Preview", email: "preview@example.com", company: "Preview", previewAs: persona.id })).rejects.toThrow(/preview/i);
      await expect(upsertAttendeeAgendaIntent({ eventId, attendeeId: persona.id, plannedSessionIds: ["s1"], plannedBreakoutIds: [], plannedSponsorBoothIds: [], wantsSessionReminders: true })).rejects.toThrow(/preview/i);
      await expect(joinNetworkingQueue(eventId, { attendeeId: persona.id, displayName: persona.name })).rejects.toThrow(/preview/i);
      expect(() => buildHelpRequestDraft({ agencyId: "west-peek", eventId, attendeeId: persona.id, topic: "video", subject: "help", message: "help" })).toThrow(/preview/i);
      await expect(registerGuestIdentity({ eventId, role: "speaker", name: "Preview", existingGuestId: persona.id })).rejects.toThrow(/preview/i);
    }
  });

  it("a mirror of a REAL attendee is refused too — See their view is read-only", async () => {
    const { profile } = await registerOrUpdateAttendee({ eventId, name: "Dana Rivers", email: "dana@realco.com", company: "RealCo" });
    // The real attendee may of course write.
    const posted = await postLiveRoomChatMessage({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: profile.attendeeId, displayName: profile.name, message: "I am here" });
    expect(posted.ok).toBe(true);
    // The producer looking at their view may not, even though the id contains theirs.
    await expect(postLiveRoomChatMessage({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: previewMirrorId(profile.attendeeId), displayName: profile.name, message: "not me" })).rejects.toThrow(/preview/i);
  });

  it("nothing a persona did is in the store afterwards", async () => {
    for (const persona of PREVIEW_PERSONAS) {
      await postLiveRoomChatMessage({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: persona.id, displayName: persona.name, message: "hello" }).catch(() => undefined);
      await recordAttendeeStageRequest({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: persona.id }).catch(() => undefined);
    }
    const store = getRuntimeStore();
    expect(await store.listRecentLiveChatMessages(eventId, 100)).toHaveLength(0);
    expect(await store.listAttendeeLiveCapabilities(eventId)).toHaveLength(0);
    expect(await store.listAttendeeProfiles(eventId, 100)).toHaveLength(0);
  });

  it("refusePreviewWrite names what was attempted, so a failure is legible", () => {
    expect(() => refusePreviewWrite("preview-vip", "post a chat message")).toThrow(/post a chat message/);
    expect(() => refusePreviewWrite("attendee-7", "post a chat message")).not.toThrow();
  });
});

describe("preview personas are invisible to everyone else", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-preview-hidden-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "Hidden Room", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a planted preview row is still absent from the roster, the count and the pending queue", async () => {
    await registerOrUpdateAttendee({ eventId, name: "Dana Rivers", email: "dana@realco.com", company: "RealCo" });
    // PLANTED ON PURPOSE, straight into the store past every guard: "it cannot happen" is not a
    // proof, and the whole point is that a future write path slipping through still shows nobody.
    const store = getRuntimeStore();
    const now = new Date().toISOString();
    await store.upsertAttendeeProfile({ attendeeId: "preview-attendee", eventId, emailHash: "x", name: "Preview attendee", company: "Preview", title: "", socialLinks: [], topicsOfInterest: [], networkingOptIn: true, hiddenFromDirectory: false, extraAnswers: {}, role: "attendee", status: "active", createdAt: now, updatedAt: now });
    await store.setAttendeeLiveCapability("planted", { eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: "preview-vip", canJoinLiveStream: false, canPublishCamera: false, canPublishMicrophone: false, canShareScreen: false, approvedForStage: false, revoked: false, requestStatus: "requested", requestedAt: now, updatedAt: now });

    const roster = await getAttendeeRoster({ eventId });
    expect(roster.total).toBe(1);
    expect(roster.rows.map((row) => row.attendeeId)).toEqual([expect.not.stringContaining("preview-")]);
    expect(roster.rows.some((row) => row.attendeeId.startsWith("preview-"))).toBe(false);
    expect(roster.pending.some((row) => row.attendeeId.startsWith("preview-"))).toBe(false);
  });

  it("the People directory and networking opt-in drop preview rows, searched or not", () => {
    const people = [
      { id: "attendee-1", displayName: "Dana Rivers", networkingOptIn: true },
      { id: "preview-attendee", displayName: "Preview attendee", networkingOptIn: true },
      { id: previewMirrorId("attendee-1"), displayName: "Dana Rivers", networkingOptIn: true },
    ];
    expect(searchPeople(people, "").map((person) => person.id)).toEqual(["attendee-1"]);
    expect(searchPeople(people, "dana").map((person) => person.id)).toEqual(["attendee-1"]);
    expect(filterNetworkingOptIn(people).map((person) => person.id)).toEqual(["attendee-1"]);
  });

  it("excludePreviewIdentities is the one filter, and it hard-fails nothing on an empty list", () => {
    expect(excludePreviewIdentities([], (row: string) => row)).toEqual([]);
    expect(excludePreviewIdentities(["a", "preview-vip", "mirror-a"], (row) => row)).toEqual(["a"]);
  });
});

describe("the preview surfaces need the same permission as the guest surfaces", () => {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 60_000;
  const ownerCookie: V5AccessCookiePayload = { kind: "owner", role: "owner", issuedAt, expiresAt };
  const producer: V5AccessCookiePayload = { kind: "crew", role: "producer", eventId: "room-1", issuedAt, expiresAt };
  const moderator: V5AccessCookiePayload = { kind: "crew", role: "moderator", eventId: "room-1", issuedAt, expiresAt };
  const attendeeGuest: V5AccessCookiePayload = { kind: "special_guest", role: "vip", eventId: "room-1", issuedAt, expiresAt };

  it("/venue/ is a view-as surface now, and the rule that guards it is unchanged", () => {
    expect(isViewAsPath("/venue/room-1/stage")).toBe(true);
    expect(isViewAsPath("/venue/room-1/lobby")).toBe(true);
    // Widening the SURFACES must not widen the PEOPLE.
    expect(canViewAsGuest({ owner: ownerCookie }, "room-1").ok).toBe(true);
    expect(canViewAsGuest({ crew: producer }, "room-1").ok).toBe(true);
    expect(canViewAsGuest({ crew: moderator }, "room-1").ok).toBe(false);
    expect(canViewAsGuest({ crew: attendeeGuest }, "room-1").ok).toBe(false);
  });

  it("a non-owner/operator/producer passing ?viewAs=preview-vip on /venue/ is refused", () => {
    expect(canViewAsAccessPath("/venue/room-1/lobby", "preview-vip", { owner: ownerCookie })).toBe(true);
    expect(canViewAsAccessPath("/venue/room-1/lobby", "preview-vip", { crew: producer })).toBe(true);
    expect(canViewAsAccessPath("/venue/room-1/lobby", "preview-vip", { crew: moderator })).toBe(false);
    expect(canViewAsAccessPath("/venue/room-1/lobby", "preview-vip", {})).toBe(false);
    // Another event's producer, and a mirror of a real attendee, follow exactly the same rule.
    expect(canViewAsAccessPath("/venue/room-2/lobby", "preview-vip", { crew: producer })).toBe(false);
    expect(canViewAsAccessPath("/venue/room-1/stage", previewMirrorId("attendee-7"), { crew: moderator })).toBe(false);
    expect(canViewAsAccessPath("/venue/room-1/stage", previewMirrorId("attendee-7"), { crew: producer })).toBe(true);
  });

  it("every persona names a role and a page the menu can open", () => {
    expect(PREVIEW_PERSONAS.map((persona) => persona.id)).toEqual(["preview-attendee", "preview-vip", "preview-speaker", "preview-sponsor", "preview-client"]);
    expect(previewPersona("preview-vip")?.vip).toBe(true);
    expect(previewPersona("preview-attendee")?.vip).toBe(false);
    expect(previewPersona("preview-speaker")?.path("room-1")).toBe("/speaker/events/room-1/green-room");
    expect(previewPersona("preview-client")?.path("room-1", "acme")).toBe("/client/acme/events/room-1");
    expect(previewPersona("preview-nobody")).toBeUndefined();
  });
});

describe("diagnosing an attendee tells the three failures apart", () => {
  const checkedAt = "2026-09-16T12:00:00.000Z";
  const room = (overrides: Partial<LiveKitRoomSnapshot> = {}): LiveKitRoomSnapshot => ({ reachable: true, roomName: "room-1-main-stage", participants: [], publishingTracks: 2, checkedAt, ...overrides });
  const present = { identity: "attendee-7", state: "ACTIVE", isPublisher: false, canSubscribe: true, tracks: [] };
  const session = (overrides: Partial<AttendeeSession> = {}): AttendeeSession => ({ sessionId: "s1", attendeeId: "attendee-7", eventId: "room-1", role: "attendee", status: "active", issuedAt: checkedAt, expiresAt: checkedAt, ...overrides });
  const diagnose = (snapshot: LiveKitRoomSnapshot, s?: AttendeeSession) => diagnoseAttendee({ attendeeId: "attendee-7", room: snapshot, session: s, currentBuildId: "build-2" });

  it("never connected: no participant for their identity", () => {
    expect(diagnose(room(), session({ clientSubscribedTracks: 3, clientConnectionQuality: "excellent" })).verdict).toBe("never_connected");
  });

  it("connected but subscribed to nothing is OURS, and says so", () => {
    const result = diagnose(room({ participants: [present] }), session({ clientSubscribedTracks: 0, clientConnectionQuality: "excellent" }));
    expect(result.verdict).toBe("receiving_nothing");
    expect(result.headline).toMatch(/ours, not theirs/i);
  });

  it("subscribed but poor is THEIRS, and says so", () => {
    const result = diagnose(room({ participants: [present] }), session({ clientSubscribedTracks: 2, clientConnectionQuality: "poor" }));
    expect(result.verdict).toBe("poor_connection");
    expect(result.headline).toMatch(/their network/i);
  });

  it("nothing on air is not blamed on the attendee", () => {
    expect(diagnose(room({ participants: [present], publishingTracks: 0 }), session({ clientSubscribedTracks: 0, clientConnectionQuality: "good" })).verdict).toBe("nothing_on_air");
  });

  it("a probe that did not run reads unknown, NEVER green", () => {
    expect(diagnose(room({ reachable: false, reason: "LiveKit credentials missing" })).verdict).toBe("unknown");
    // In the room, but their browser has never reported: we do not know, so we do not say.
    expect(diagnose(room({ participants: [present] }), session()).verdict).toBe("unknown");
    expect(diagnose(room({ participants: [present] }), undefined).verdict).toBe("unknown");
  });

  it("a stale build is flagged against the current one", () => {
    expect(diagnose(room({ participants: [present] }), session({ clientBuildId: "build-1", clientSubscribedTracks: 2, clientConnectionQuality: "good" })).buildMatchesCurrent).toBe(false);
    expect(diagnose(room({ participants: [present] }), session({ clientBuildId: "build-2", clientSubscribedTracks: 2, clientConnectionQuality: "good" })).buildMatchesCurrent).toBe(true);
    expect(diagnose(room({ participants: [present] }), session({ clientSubscribedTracks: 2, clientConnectionQuality: "good" })).buildMatchesCurrent).toBeUndefined();
  });

  it("the browser label is derived, so no raw user agent is ever kept", () => {
    expect(describeClient("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")).toBe("Chrome 140 on macOS");
    expect(describeClient("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari 18 on iOS");
    expect(describeClient("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0")).toBe("Firefox 130 on Windows");
    expect(describeClient(undefined)).toBeUndefined();
  });
});
