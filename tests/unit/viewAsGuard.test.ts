import { describe, expect, it } from "vitest";
import { canViewAsGuest, isViewAsPath, withViewAs } from "@/lib/auth/viewAsGuard";
import { canViewAsAccessPath } from "@/lib/auth/v5RouteAuthorization";
import type { V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import type { V4CrewRole } from "@/types/v4";

/** Who may open a guest's real pages as that guest: owner, operator (event), producer / EP crew (event). Nobody else. */
const issuedAt = Date.now();
const expiresAt = issuedAt + 60_000;
const crew = (role: V4CrewRole, eventId = "room-1"): V5AccessCookiePayload => ({ kind: "crew", role, eventId, issuedAt, expiresAt });
const owner: V5AccessCookiePayload = { kind: "owner", role: "owner", issuedAt, expiresAt };
const operator = (eventId?: string): V5AccessCookiePayload => ({ kind: "operator", role: "executive_producer", eventId, issuedAt, expiresAt });
const guest: V5AccessCookiePayload = { kind: "special_guest", role: "speaker", eventId: "room-1", issuedAt, expiresAt };

describe("view-as guard", () => {
  it("owner, operator, producer and executive producer may; every other role and cookie may not", () => {
    expect(canViewAsGuest({ owner }, "room-1")).toMatchObject({ ok: true, kind: "owner" });
    expect(canViewAsGuest({ operator: operator() }, "room-1")).toMatchObject({ ok: true, kind: "operator" });
    expect(canViewAsGuest({ operator: operator("room-1") }, "room-1")).toMatchObject({ ok: true });
    expect(canViewAsGuest({ crew: crew("producer") }, "room-1")).toMatchObject({ ok: true, kind: "producer", label: "the producer" });
    expect(canViewAsGuest({ crew: crew("executive_producer") }, "room-1")).toMatchObject({ ok: true, kind: "producer", label: "the executive producer" });
    for (const role of ["crew", "technical_director", "show_caller", "moderator", "va", "support"] as V4CrewRole[]) expect(canViewAsGuest({ crew: crew(role) }, "room-1"), role).toEqual({ ok: false });
    expect(canViewAsGuest({}, "room-1")).toEqual({ ok: false });
  });

  it("is scoped to the event: another event's operator or producer cannot", () => {
    expect(canViewAsGuest({ operator: operator("room-2") }, "room-1")).toEqual({ ok: false });
    expect(canViewAsGuest({ crew: crew("producer", "room-2") }, "room-1")).toEqual({ ok: false });
  });

  it("a special-guest cookie is never a viewer, even the speaker's own", () => {
    // The guard only reads owner / operator / crew slots; a guest cookie in any slot is not one of them.
    expect(canViewAsGuest({ crew: guest }, "room-1")).toEqual({ ok: false });
    expect(canViewAsGuest({ owner: guest }, "room-1")).toEqual({ ok: false });
  });

  it("the middleware lets a viewer through only on guest paths with ?viewAs, for the path's event", () => {
    const payloads = { crew: crew("producer") };
    expect(canViewAsAccessPath("/speaker/events/room-1/green-room", "speaker-1", payloads)).toBe(true);
    expect(canViewAsAccessPath("/sponsor/events/room-1/booth", "sponsor-1", payloads)).toBe(true);
    expect(canViewAsAccessPath("/client/acme/events/room-1", "client-1", payloads)).toBe(true);
    expect(canViewAsAccessPath("/speaker/events/room-1/green-room", null, payloads)).toBe(false);
    expect(canViewAsAccessPath("/speaker/events/room-2/green-room", "speaker-1", payloads)).toBe(false);
    expect(canViewAsAccessPath("/app/events/room-1", "speaker-1", payloads)).toBe(false);
    expect(canViewAsAccessPath("/speaker/events/room-1/green-room", "speaker-1", { crew: crew("moderator") })).toBe(false);
    expect(isViewAsPath("/crew/events/room-1")).toBe(false);
  });

  it("links inside the preview keep the parameter", () => {
    expect(withViewAs("/speaker/events/room-1/teleprompter", "sp-1")).toBe("/speaker/events/room-1/teleprompter?viewAs=sp-1");
    expect(withViewAs("/speaker/events/room-1?x=1", "sp-1")).toBe("/speaker/events/room-1?x=1&viewAs=sp-1");
    expect(withViewAs("/speaker/events/room-1")).toBe("/speaker/events/room-1");
  });
});
