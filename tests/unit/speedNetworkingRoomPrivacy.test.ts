import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The 1:1 networking room is private to two people (16 Sep 2026: the owner's own match rendered
 * five tiles, two of them people who were never matched with her, plus her own identity as a
 * video-less grey avatar). Reproduced against the real LiveKit project first — a room created
 * implicitly by the first join carries max_participants = 0, and a plain join token for the room
 * name lets any third party in — then closed here:
 *
 *   an identity is never derived from a display name; only role "attendee" can ever be granted a
 *   networking token; only the two attendees of that ACTIVE match; the room is created with a hard
 *   capacity of two; anyone else found in it is removed before the token is issued, as is the
 *   joiner's own earlier connection; and the room is deleted when the match ends.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const admin = vi.hoisted(() => ({
  ensureLiveKitRoomWithCapacity: vi.fn(async () => ({ configured: true as const, created: true })),
  listLiveKitRoomParticipants: vi.fn(async () => ({ configured: true as const, participants: [] as Array<{ identity: string; name: string; state: string; publishedTrackCount: number }> })),
  removeLiveKitRoomParticipant: vi.fn(async () => ({ configured: true as const, removed: true })),
  deleteLiveKitRoom: vi.fn(async () => ({ configured: true as const, deleted: true })),
}));
// Only the four network calls are stubbed; normalizeParticipantState stays real so its decoding is covered.
vi.mock("@/services/video/livekitRoomAdmin", async (importOriginal) => ({ ...(await importOriginal<object>()), ...admin }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests, getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { endMatch, getMyNetworkingState, joinNetworkingQueue, tokenAllowedForRoom } from "@/services/speed-networking/speedNetworkingService";
import { SPEED_NETWORKING_ROOM_CAPACITY, decideSpeedNetworkingRoomAdmission, prepareSpeedNetworkingRoomForJoin, speedNetworkingRoomIdentities } from "@/services/speed-networking/speedNetworkingRoomGuard";
import { createLiveKitAccessToken } from "@/services/video/livekitToken";
import { normalizeParticipantState } from "@/services/video/livekitRoomAdmin";
import type { SpeedNetworkingMatchRecord } from "@/types/speedNetworking";

const EVENT = "net-privacy-event";
const A = { attendeeId: "att-ada", displayName: "Ada", company: "Engines", title: "Founder" };
const B = { attendeeId: "att-valerie", displayName: "Valerie Taylor", company: "Cargill", title: "Specialist" };
const C = { attendeeId: "att-linus", displayName: "Linus", company: "Kernel", title: "BDFL" };

function activeMatch(overrides: Partial<SpeedNetworkingMatchRecord> = {}): SpeedNetworkingMatchRecord {
  return {
    id: "match-1",
    eventId: EVENT,
    attendeeAId: A.attendeeId,
    attendeeBId: B.attendeeId,
    normalizedPairKey: `${EVENT}::${A.attendeeId}::${B.attendeeId}`,
    roomName: `${EVENT}-net-match-1`,
    status: "active",
    startsAt: new Date(Date.now() - 10_000).toISOString(),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    ...overrides,
  };
}

function present(identity: string, name = identity, state = "ACTIVE") {
  return { identity, name, state, publishedTrackCount: 1 };
}

describe("speed networking room privacy", () => {
  describe("the LiveKit identity is never a display name", () => {
    const base = { roomId: "room-1", eventId: EVENT, role: "attendee" as const, canPublishAudio: true, canPublishVideo: true, canShareScreen: false, expiresInSeconds: 60 };
    const env = { apiKey: "k", apiSecret: "s" };

    it("gives two attendees with the same display name different identities", () => {
      const first = createLiveKitAccessToken({ env, roomName: "room-1", request: { ...base, displayName: "Ada" } });
      const second = createLiveKitAccessToken({ env, roomName: "room-1", request: { ...base, displayName: "Ada" } });
      expect(first.participantIdentity).not.toBe(second.participantIdentity);
      expect(first.participantIdentity).not.toContain("ada");
      expect(second.participantIdentity).not.toContain("ada");
    });

    it("uses the stable attendee id when one is given, so a rejoin is the same person and not a third body", () => {
      const first = createLiveKitAccessToken({ env, roomName: "room-1", request: { ...base, displayName: "Ada", profileId: A.attendeeId } });
      const second = createLiveKitAccessToken({ env, roomName: "room-1", request: { ...base, displayName: "Ada Lovelace", profileId: A.attendeeId } });
      expect(first.participantIdentity).toBe(A.attendeeId);
      expect(second.participantIdentity).toBe(A.attendeeId);
    });
  });

  describe("only the two matched attendees are admitted", () => {
    const match = activeMatch();

    it("refuses every role that is not a registered attendee, whatever room name it asks for", () => {
      for (const role of ["observer", "producer", "host", "speaker", "sponsor", "contractor", "client"]) {
        const decision = decideSpeedNetworkingRoomAdmission({ match, roomName: match.roomName, attendeeId: A.attendeeId, role });
        expect(decision.ok, `role ${role} must not reach a private 1:1`).toBe(false);
        expect(decision.reason).toMatch(/private 1:1 between two registered attendees/);
      }
    });

    it("admits each of the two matched attendees", () => {
      for (const attendeeId of [A.attendeeId, B.attendeeId]) {
        expect(decideSpeedNetworkingRoomAdmission({ match, roomName: match.roomName, attendeeId, role: "attendee" }).ok).toBe(true);
      }
      expect(speedNetworkingRoomIdentities(match)).toEqual([A.attendeeId, B.attendeeId]);
    });

    it("refuses a third attendee, another pair's room, and a match that is over", () => {
      expect(decideSpeedNetworkingRoomAdmission({ match, roomName: match.roomName, attendeeId: C.attendeeId, role: "attendee" }).ok).toBe(false);
      expect(decideSpeedNetworkingRoomAdmission({ match, roomName: `${EVENT}-net-match-other`, attendeeId: A.attendeeId, role: "attendee" }).ok).toBe(false);
      expect(decideSpeedNetworkingRoomAdmission({ match: activeMatch({ status: "ended" }), roomName: match.roomName, attendeeId: A.attendeeId, role: "attendee" }).ok).toBe(false);
      expect(decideSpeedNetworkingRoomAdmission({ match: activeMatch({ expiresAt: new Date(Date.now() - 1_000).toISOString() }), roomName: match.roomName, attendeeId: A.attendeeId, role: "attendee" }).ok).toBe(false);
      expect(decideSpeedNetworkingRoomAdmission({ match: undefined, roomName: match.roomName, attendeeId: A.attendeeId, role: "attendee" }).ok).toBe(false);
    });

    it("names everyone in the room who does not belong there, and the joiner's own earlier connection", () => {
      const decision = decideSpeedNetworkingRoomAdmission({
        match,
        roomName: match.roomName,
        attendeeId: A.attendeeId,
        role: "attendee",
        participants: [present(B.attendeeId, "Valerie Taylor"), present(A.attendeeId, "Ada"), present("att-stranger", "A Woman In Glasses"), present("crew-7", "SEQUOIA TAYLOR"), present("att-gone", "Gone", "DISCONNECTED")],
      });
      expect(decision.ok).toBe(true);
      expect(decision.strangers).toEqual(["att-stranger", "crew-7"]);
      expect(decision.staleSelf).toEqual([A.attendeeId]);
      // A participant LiveKit already reports as gone is not purged again.
      expect(decision.strangers).not.toContain("att-gone");
    });
  });

  describe("the room itself is capped and cleaned", () => {
    beforeEach(() => { for (const fn of Object.values(admin)) fn.mockClear(); });

    it("caps the LiveKit room at two and removes everyone who does not belong before minting a token", async () => {
      const match = activeMatch();
      admin.listLiveKitRoomParticipants.mockResolvedValueOnce({ configured: true, participants: [present("att-stranger"), present(A.attendeeId)] });
      const prepared = await prepareSpeedNetworkingRoomForJoin({ match, roomName: match.roomName, attendeeId: A.attendeeId, role: "attendee" });
      expect(prepared.ok).toBe(true);
      expect(SPEED_NETWORKING_ROOM_CAPACITY).toBe(2);
      expect(admin.ensureLiveKitRoomWithCapacity).toHaveBeenCalledWith(expect.objectContaining({ roomName: match.roomName, maxParticipants: 2 }));
      expect(prepared.purged).toEqual(["att-stranger", A.attendeeId]);
      expect(admin.removeLiveKitRoomParticipant).toHaveBeenCalledWith(match.roomName, "att-stranger");
      expect(admin.removeLiveKitRoomParticipant).toHaveBeenCalledWith(match.roomName, A.attendeeId);
    });

    it("never touches the room for a request it refuses", async () => {
      const match = activeMatch();
      const prepared = await prepareSpeedNetworkingRoomForJoin({ match, roomName: match.roomName, attendeeId: C.attendeeId, role: "attendee" });
      expect(prepared.ok).toBe(false);
      expect(admin.ensureLiveKitRoomWithCapacity).not.toHaveBeenCalled();
      expect(admin.removeLiveKitRoomParticipant).not.toHaveBeenCalled();
    });

    it("still grants the two matched attendees when LiveKit cannot be reached, and says so", async () => {
      const match = activeMatch();
      admin.listLiveKitRoomParticipants.mockResolvedValueOnce({ configured: false } as never);
      const prepared = await prepareSpeedNetworkingRoomForJoin({ match, roomName: match.roomName, attendeeId: A.attendeeId, role: "attendee" });
      expect(prepared).toMatchObject({ ok: true, livekitReachable: false, purged: [] });
    });

    it("reads the LiveKit participant state whether it arrives as a name or an ordinal", () => {
      expect(normalizeParticipantState("ACTIVE")).toBe("ACTIVE");
      expect(normalizeParticipantState(3)).toBe("DISCONNECTED");
      expect(normalizeParticipantState(undefined)).toBe("UNKNOWN");
    });
  });

  describe("against the runtime store", () => {
    let tempDir: string;
    beforeEach(() => {
      for (const fn of Object.values(admin)) fn.mockClear();
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-net-privacy-"));
      process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
      setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
      resetOverlayForTests();
    });
    afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

    it("deletes the LiveKit room when the match ends, so the next match starts empty", async () => {
      await joinNetworkingQueue(EVENT, A);
      await joinNetworkingQueue(EVENT, B);
      const mine = await getMyNetworkingState(EVENT, A.attendeeId);
      expect(mine.status).toBe("matched");
      const roomName = mine.match!.roomName;
      await endMatch(EVENT, mine.match!.id, "next");
      expect(admin.deleteLiveKitRoom).toHaveBeenCalledWith(roomName);
      // And the grant that guarded that room no longer holds.
      const stored = (await getRuntimeStore().listSpeedNetworkingMatches(EVENT)).find((item) => item.roomName === roomName)!;
      expect(tokenAllowedForRoom(stored, roomName, A.attendeeId)).toBe(false);
      expect(decideSpeedNetworkingRoomAdmission({ match: stored, roomName, attendeeId: A.attendeeId, role: "attendee" }).ok).toBe(false);
    });
  });
});
