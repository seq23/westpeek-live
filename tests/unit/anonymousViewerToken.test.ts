import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Access control on the video token route (restored 10 Nov 2026 from the cut
 * validate_venue_attendee_ux_contract.js, hostile review): a viewer with no attendee
 * session may WATCH a watchable room, as "Guest", with no publish permission at all,
 * and is refused a token for any room that is not watchable.
 */
const join = vi.fn(async (input: unknown) => ({ token: "t", input }));
vi.mock("@/services/video/livekitRoomUiService", () => ({ buildResilientVideoJoinResult: (input: unknown) => join(input) }));
vi.mock("@/lib/auth/videoTokenRequestGuard", () => ({ authorizeVideoTokenRequest: async () => ({ ok: true, identity: undefined }) }));
vi.mock("@/services/attendees/attendeeSessionService", () => ({ getCurrentAttendeeIdentity: async () => undefined, currentAttendeeMayHoldPrivilege: async () => true }));
vi.mock("@/services/venue/attendeeLivePermissionService", () => ({
  canAttendeeJoinLive: async () => ({ canJoin: true }),
  canAttendeePublishLive: async () => ({ canPublishAudio: true, canPublishVideo: true, canShareScreen: true }),
}));
vi.mock("@/services/guests/guestIdentityService", () => ({ getCurrentGuestIdentity: async () => undefined }));
vi.mock("@/services/guests/guestStateService", () => ({ getSpeakerStageState: async () => undefined }));
vi.mock("@/services/guests/guestVideoGrants", () => ({ decideGuestVideoGrant: () => ({ ok: false, reason: "no" }) }));
vi.mock("@/services/speed-networking/speedNetworkingRoomGuard", () => ({ prepareSpeedNetworkingRoomForJoin: async () => ({ ok: false, reason: "no" }) }));
vi.mock("@/services/speed-networking/speedNetworkingService", () => ({ findActiveMatchForRoom: async () => undefined, tokenAllowedForRoom: () => false }));

const post = async (body: Record<string, unknown>) => {
  const { POST } = await import("@/app/api/video/livekit-token/route");
  return POST(new Request("https://example.test/api/video/livekit-token", { method: "POST", body: JSON.stringify(body) }));
};

describe("anonymous viewer video token", () => {
  beforeEach(() => join.mockClear());

  it("is watch-only: issued as Guest with every publish permission off", async () => {
    const res = await post({ eventId: "evt", roomId: "evt-main", roomType: "main_stage", role: "attendee" });
    expect(res.status).toBe(200);
    expect(join).toHaveBeenCalledTimes(1);
    const input = join.mock.calls[0][0] as { displayName: string; profileId?: string; permissionOverride: Record<string, boolean> };
    expect(input.displayName).toBe("Guest");
    expect(input.profileId).toBeUndefined();
    expect(input.permissionOverride).toEqual({ canPublishAudio: false, canPublishVideo: false, canShareScreen: false });
  });

  it("is refused for a room that is not watchable", async () => {
    const res = await post({ eventId: "evt", roomId: "evt-green", roomType: "green_room", role: "attendee" });
    expect(res.status).toBe(403);
    const res2 = await post({ eventId: "evt", roomId: "evt-x", roomType: "workshop", role: "attendee" });
    expect(res2.status).toBe(403);
    expect(join).not.toHaveBeenCalled();
  });
});
