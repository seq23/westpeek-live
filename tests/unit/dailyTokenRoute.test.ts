import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/video/daily-token makes a paid Daily room. Until 23 Nov 2026 the guard let an "observer" (no
 * session, no code, nothing) through every token route, so anyone could make Daily rooms for any
 * eventId they typed. The real guard runs here; Daily itself is the stand-in.
 */
const createVideoRoom = vi.fn(async () => ({ id: "r1", providerRoomId: "r1", joinUrl: "https://example.daily.co/r1" }));
const createVideoRoomToken = vi.fn(async () => ({ token: "daily-token" }));
vi.mock("@/services/video", () => ({
  buildDefaultTokenPermissions: () => ({ canPublishAudio: false, canPublishVideo: false, canShareScreen: false }),
  createVideoRoom: () => createVideoRoom(),
  createVideoRoomToken: () => createVideoRoomToken(),
  getVideoFallbackPolicy: () => ({ dailyAutomaticFallbackEnabled: true }),
}));
vi.mock("@/services/attendees/attendeeSessionService", () => ({ getCurrentAttendeeIdentity: async () => undefined }));
const sessionCookies = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (sessionCookies.has(name) ? { value: sessionCookies.get(name) } : undefined) }) }));

const post = async (body: Record<string, unknown>) => {
  const { POST } = await import("@/app/api/video/daily-token/route");
  return POST(new Request("https://example.test/api/video/daily-token", { method: "POST", body: JSON.stringify(body) }));
};

describe("daily-token", () => {
  beforeEach(() => {
    createVideoRoom.mockClear();
    createVideoRoomToken.mockClear();
  });

  it("refuses an observer, and an attendee with no session, before any Daily room is made", async () => {
    const observer = await post({ eventId: "any-event-at-all", roomId: "x", roomType: "main_stage", role: "observer", displayName: "Bot" });
    expect(observer.status).toBe(403);
    const attendee = await post({ eventId: "any-event-at-all", roomId: "x", roomType: "main_stage", role: "attendee" });
    expect(attendee.status).toBe(403);
    expect(createVideoRoom).not.toHaveBeenCalled();
  });

  it("refuses an observer on the stage fallback and the Zoom signature too, which share the guard", async () => {
    const { authorizeVideoTokenRequest } = await import("@/lib/auth/videoTokenRequestGuard");
    expect(await authorizeVideoTokenRequest({ role: "observer", eventId: "evt" })).toMatchObject({ ok: false });
    expect(await authorizeVideoTokenRequest({ role: "observer", eventId: "evt", allowAnonymousViewer: true })).toEqual({ ok: true, identity: undefined });
  });
});
