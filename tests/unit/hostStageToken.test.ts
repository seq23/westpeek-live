import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A host token publishes on the MAIN STAGE without anyone's approval, so the token route gives one
 * only to whoever may go live (owner, operator, crew whose role holds go_live), refuses a revoked
 * crew link, fails closed (503) when it cannot check, and mints the identity itself (23 Nov 2026;
 * before this, any crew cookie for the event, revoked or not, got a publish token). The real route
 * and live-control guard run with real signed cookies; the LiveKit signer and the host-link read
 * are stand-ins.
 */
const join = vi.fn(async (input: unknown) => ({ token: { token: "t" }, livekitUrl: "wss://example.livekit.cloud", input }));
vi.mock("@/services/video/livekitRoomUiService", () => ({ buildLiveKitJoinResult: (input: unknown) => join(input), buildResilientVideoJoinResult: async () => ({ token: { token: "daily" } }) }));
vi.mock("@/services/events/eventRepository", () => ({ findEventRecord: async () => ({ id: "evt", status: "live" }) }));
vi.mock("@/services/attendees/attendeeSessionService", () => ({ getCurrentAttendeeIdentity: async () => undefined, currentAttendeeMayHoldPrivilege: async () => true }));
vi.mock("@/services/venue/attendeeLivePermissionService", () => ({ canAttendeeJoinLive: async () => ({ canJoin: true }), canAttendeePublishLive: async () => ({ canPublishAudio: false, canPublishVideo: false, canShareScreen: false }) }));
vi.mock("@/services/guests/guestIdentityService", () => ({ getCurrentGuestIdentity: async () => undefined }));
vi.mock("@/services/guests/guestStateService", () => ({ getSpeakerStageState: async () => undefined }));
vi.mock("@/services/guests/guestVideoGrants", () => ({ decideGuestVideoGrant: () => ({ ok: false, reason: "no" }) }));
vi.mock("@/services/speed-networking/speedNetworkingRoomGuard", () => ({ prepareSpeedNetworkingRoomForJoin: async () => ({ ok: false, reason: "no" }) }));
vi.mock("@/services/speed-networking/speedNetworkingService", () => ({ findActiveMatchForRoom: async () => undefined, tokenAllowedForRoom: () => false }));
let hostLink: { codeVersion: number } | "down" = { codeVersion: 0 };
vi.mock("@/services/events/hostLinkService", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/events/hostLinkService")>();
  return { ...original, getHostLinkState: async () => { if (hostLink === "down") throw new original.AccessStateUnavailableError("down"); return { codeVersion: hostLink.codeVersion, grants: [] }; } };
});
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: () => undefined }), headers: async () => new Headers() }));

import { createV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import type { V4CrewRole } from "@/types/v4";

async function signIn(kind: "owner" | "crew", role?: V4CrewRole, codeVersion?: number) {
  const env = getEnv();
  const names = getV5AccessCookieNames(env);
  jar.clear();
  const payload = kind === "owner" ? { kind, role: "owner", issuedAt: Date.now(), expiresAt: Date.now() + 60_000 } : { kind, role, eventId: "evt", codeVersion, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 };
  jar.set(kind === "owner" ? names.ownerCookieName : names.crewCookieName, await createV5AccessCookie(payload as never, getV5AccessCookieSecret(env)));
}
const post = async (body: Record<string, unknown>) => {
  const { POST } = await import("@/app/api/video/livekit-token/route");
  return POST(new Request("https://example.test/api/video/livekit-token", { method: "POST", headers: { "cf-connecting-ip": "198.51.100.40" }, body: JSON.stringify(body) }));
};
const hostOnStage = { eventId: "evt", roomId: "evt-main", roomType: "main_stage", role: "host", displayName: "Valerie" };

describe("host token on the main stage", () => {
  beforeEach(() => { join.mockClear(); jar.clear(); hostLink = { codeVersion: 0 }; vi.spyOn(console, "error").mockImplementation(() => undefined); });

  it("is refused with no cookie at all, or to an attendee asking for the host role", async () => {
    expect((await post(hostOnStage)).status).toBe(403);
    expect((await post({ ...hostOnStage, role: "producer" })).status).toBe(403);
    expect(join).not.toHaveBeenCalled();
  });

  it("is refused to a crew role that may not go live, and to a revoked crew link", async () => {
    await signIn("crew", "moderator", 1);
    expect((await post(hostOnStage)).status).toBe(403);
    hostLink = { codeVersion: 2 };
    await signIn("crew", "technical_director", 1);
    expect((await post(hostOnStage)).status).toBe(403);
    expect(join).not.toHaveBeenCalled();
  });

  it("fails closed when the crew link cannot be checked", async () => {
    hostLink = "down";
    await signIn("crew", "technical_director", 1);
    expect((await post(hostOnStage)).status).toBe(503);
    expect(join).not.toHaveBeenCalled();
  });

  it("goes to the owner and to go_live crew, with an identity the server minted, never the one sent", async () => {
    for (const who of [() => signIn("owner"), () => signIn("crew", "technical_director", 1)]) {
      hostLink = { codeVersion: 1 };
      await who();
      const res = await post({ ...hostOnStage, profileId: "attendee-123" });
      expect(res.status).toBe(200);
    }
    expect(join).toHaveBeenCalledTimes(2);
    for (const [input] of join.mock.calls as unknown as [{ profileId?: string; role: string }][]) {
      expect(input.profileId).toMatch(/^host-[0-9a-f-]{36}$/);
      expect(input.profileId).not.toBe("attendee-123");
    }
  });
});
