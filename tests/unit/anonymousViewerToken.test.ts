import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInProcessRateLimiter, GATE_ATTEMPTS_PER_WINDOW, resetGateAttemptsForTests, setGateLimiterForTests } from "@/services/access/gateAttemptLimiter";

/**
 * Access control on the video token route (restored 10 Nov 2026 from the cut
 * validate_venue_attendee_ux_contract.js, hostile review): a viewer with no attendee
 * session may WATCH a watchable room, as "Guest", with no publish permission at all,
 * and is refused a token for any room that is not watchable.
 *
 * Since 23 Nov 2026 (an outside scan): only for an event that exists and is open to the public now,
 * counted per address, and from LiveKit alone, never a paid Daily room. The real guard, limiter and
 * venue gate run here; only the event lookup and the LiveKit signer are stand-ins.
 */
const join = vi.fn(async (input: unknown) => ({ token: { token: "t" }, livekitUrl: "wss://example.livekit.cloud", input }));
const dailyFallback = vi.fn(async () => ({ token: { token: "daily" }, fallbackApplied: true }));
vi.mock("@/services/video/livekitRoomUiService", () => ({
  buildLiveKitJoinResult: (input: unknown) => join(input),
  buildResilientVideoJoinResult: () => dailyFallback(),
}));
type EventStub = { id: string; status: string } | undefined;
let event: EventStub | Error = { id: "evt", status: "live" };
vi.mock("@/services/events/eventRepository", () => ({
  findEventRecord: async () => {
    if (event instanceof Error) throw event;
    return event;
  },
}));
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

const post = async (body: Record<string, unknown>, ip = "198.51.100.30") => {
  const { POST } = await import("@/app/api/video/livekit-token/route");
  return POST(new Request("https://example.test/api/video/livekit-token", { method: "POST", headers: { "cf-connecting-ip": ip }, body: JSON.stringify(body) }));
};
const stage = { eventId: "evt", roomId: "evt-main", roomType: "main_stage", role: "attendee" };

describe("anonymous viewer video token", () => {
  beforeEach(() => {
    join.mockClear();
    dailyFallback.mockClear();
    event = { id: "evt", status: "live" };
    resetGateAttemptsForTests();
    setGateLimiterForTests(createInProcessRateLimiter());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    setGateLimiterForTests("unset");
    vi.restoreAllMocks();
  });

  it("is watch-only: issued as Guest with every publish permission off, for an attendee and an observer alike", async () => {
    for (const role of ["attendee", "observer"]) {
      const res = await post({ ...stage, role, displayName: "Mallory the Producer" });
      expect(res.status).toBe(200);
    }
    expect(join).toHaveBeenCalledTimes(2);
    for (const [input] of join.mock.calls as unknown as [{ displayName: string; profileId?: string; permissionOverride: Record<string, boolean> }][]) {
      expect(input.displayName).toBe("Guest");
      expect(input.profileId).toBeUndefined();
      expect(input.permissionOverride).toEqual({ canPublishAudio: false, canPublishVideo: false, canShareScreen: false });
    }
  });

  it("is served for a registration-open or upcoming event too: the venue shows the stage before it starts", async () => {
    for (const status of ["registration_open", "published", "pre_event"]) {
      event = { id: "evt", status };
      expect((await post(stage)).status).toBe(200);
    }
  });

  it("is refused for a room that is not watchable", async () => {
    const res = await post({ eventId: "evt", roomId: "evt-green", roomType: "green_room", role: "attendee" });
    expect(res.status).toBe(403);
    const res2 = await post({ eventId: "evt", roomId: "evt-x", roomType: "workshop", role: "attendee" });
    expect(res2.status).toBe(403);
    const res3 = await post({ eventId: "evt", roomId: "evt-green", roomType: "green_room", role: "observer", displayName: "x" });
    expect(res3.status).toBe(403);
    expect(join).not.toHaveBeenCalled();
  });

  it("is refused for an event that does not exist, or that an id only resolves to by its join code", async () => {
    event = undefined;
    expect((await post({ ...stage, eventId: "made-up-event" })).status).toBe(404);
    expect((await post({ ...stage, role: "observer", displayName: "x", eventId: "made-up-event" })).status).toBe(404);
    event = { id: "evt", status: "live" };
    expect((await post({ ...stage, eventId: "wpl-abc123" })).status).toBe(404);
    expect(join).not.toHaveBeenCalled();
  });

  it("is refused for an event the public cannot see now: a draft, an ended or an archived one", async () => {
    for (const status of ["draft", "approved", "ended", "replay_available", "archived"]) {
      event = { id: "evt", status };
      expect((await post(stage)).status).toBe(403);
    }
    expect(join).not.toHaveBeenCalled();
  });

  it("is counted per address: past the minute's allowance it is a 429 that says when to come back, and other addresses still watch", async () => {
    for (let i = 0; i < GATE_ATTEMPTS_PER_WINDOW; i += 1) expect((await post(stage)).status).toBe(200);
    const refused = await post(stage);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("60");
    expect(await refused.json()).toMatchObject({ ok: false, retryInSeconds: 60 });
    expect(join).toHaveBeenCalledTimes(GATE_ATTEMPTS_PER_WINDOW);
    expect((await post(stage, "198.51.100.31")).status).toBe(200);
  });

  it("keeps a running show watchable when the limiter itself is down (logged), and still checks the event", async () => {
    setGateLimiterForTests(undefined);
    expect((await post(stage)).status).toBe(200);
    event = undefined;
    expect((await post(stage)).status).toBe(404);
  });

  it("says so plainly when the event cannot be looked up, and issues nothing", async () => {
    event = new Error("D1_ERROR: unavailable");
    const res = await post(stage);
    expect(res.status).toBe(503);
    expect(join).not.toHaveBeenCalled();
  });

  it("never falls back to a paid Daily room: a LiveKit failure is a 503 the player shows", async () => {
    join.mockRejectedValueOnce(new Error("LIVEKIT_API_SECRET is required"));
    const res = await post(stage);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, providerFailure: true });
    expect(dailyFallback).not.toHaveBeenCalled();
  });
});
