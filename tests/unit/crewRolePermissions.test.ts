import { describe, expect, it } from "vitest";
import { CREW_ROLES, crewActionPermissions, crewDeniedReason, crewRoleDescriptions, roleAllows, rolesAllowed, type CrewAction } from "@/lib/auth/crewRolePermissions";
import { authorizeLiveControl } from "@/lib/auth/liveControlRequestGuard";
import { crewViewerFromPayloads, viewerCan, viewerDenied } from "@/lib/auth/crewViewer";
import { canPerformCrewAction } from "@/lib/auth/v5RouteAuthorization";
import type { V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import type { V4CrewRole } from "@/types/v4";

/**
 * THE crew permission map, role by role, action by action; the server guard that refuses with
 * the same sentence the deck shows; and the viewer the deck and the badge render from. Owner and
 * operator bypass everything. Host = the executive_producer crew role for that one event.
 */
const issuedAt = Date.now();
const expiresAt = issuedAt + 60_000;
const crew = (role: V4CrewRole, eventId = "room-1"): V5AccessCookiePayload => ({ kind: "crew", role, eventId, issuedAt, expiresAt });
const owner: V5AccessCookiePayload = { kind: "owner", role: "owner", issuedAt, expiresAt };
const operator: V5AccessCookiePayload = { kind: "operator", role: "executive_producer", issuedAt, expiresAt };

const DECK_ACTIONS: CrewAction[] = ["go_live", "moderate_chat", "manage_stage_access", "manage_cue_cards", "advance_run_of_show"];

/** The map the owner signed off: which roles may take each deck action. */
const EXPECTED: Record<CrewAction, V4CrewRole[]> = {
  view_event: ["crew", "executive_producer", "producer", "technical_director", "show_caller", "moderator", "va", "support"],
  view_run_of_show: ["crew", "executive_producer", "producer", "technical_director", "show_caller", "moderator", "va", "support"],
  go_live: ["executive_producer", "producer", "technical_director"],
  moderate_chat: ["executive_producer", "producer", "show_caller", "moderator"],
  manage_stage_access: ["executive_producer", "producer", "show_caller", "moderator"],
  manage_cue_cards: ["executive_producer", "producer", "show_caller"],
  advance_run_of_show: ["executive_producer", "producer", "show_caller"],
  delay_segment: ["executive_producer", "show_caller"],
  log_incident: ["executive_producer", "producer", "show_caller", "moderator", "support"],
  view_support: ["executive_producer", "support"],
  edit_draft_setup: ["executive_producer", "va"],
  mark_ready_for_review: ["executive_producer", "va"],
  publish_event: ["executive_producer", "producer"],
  deploy_event: ["executive_producer"],
  archive_event: ["executive_producer"],
  view_audit: ["executive_producer", "producer"],
  moderate_session: ["executive_producer", "moderator"],
  switch_video_fallback: ["executive_producer", "technical_director"],
  clear_video_fallback: ["executive_producer", "technical_director"],
  run_video_health_check: ["executive_producer", "technical_director"],
};

describe("crew permission map", () => {
  it("covers every role and every action exactly as agreed", () => {
    expect(Object.keys(crewActionPermissions).sort()).toEqual([...CREW_ROLES].sort());
    for (const [action, roles] of Object.entries(EXPECTED) as Array<[CrewAction, V4CrewRole[]]>) {
      expect(rolesAllowed(action), action).toEqual(roles);
      for (const role of CREW_ROLES) expect(roleAllows(role, action), `${role} → ${action}`).toBe(roles.includes(role));
    }
  });

  it("plain crew views everything and acts on nothing; support views + logs incidents; VA drafts", () => {
    for (const action of DECK_ACTIONS) {
      expect(roleAllows("crew", action)).toBe(false);
      expect(roleAllows("support", action)).toBe(false);
      expect(roleAllows("va", action)).toBe(false);
    }
    expect(roleAllows("crew", "view_event")).toBe(true);
    expect(roleAllows("support", "log_incident")).toBe(true);
    expect(roleAllows("support", "view_support")).toBe(true);
    expect(roleAllows("va", "edit_draft_setup")).toBe(true);
  });

  it("the cookie helper reads the same map", () => {
    expect(canPerformCrewAction(crew("moderator"), "go_live", "room-1")).toBe(false);
    expect(canPerformCrewAction(crew("technical_director"), "go_live", "room-1")).toBe(true);
    expect(canPerformCrewAction(crew("technical_director", "room-2"), "go_live", "room-1")).toBe(false);
  });

  it("every role has a one-line description for the gate and the badge", () => {
    for (const role of CREW_ROLES) expect(crewRoleDescriptions[role].length, role).toBeGreaterThan(20);
  });

  it("the denial sentence names the role and who may act", () => {
    expect(crewDeniedReason("moderator", "go_live")).toBe("Moderator can't move the stream or end the show — that's the Executive Producer, a producer, or the Technical Director.");
    expect(crewDeniedReason("technical_director", "moderate_chat")).toMatch(/^Technical Director can't moderate chat — that's the Executive Producer, a producer, the Show Caller, or a moderator\.$/);
  });
});

describe("live control guard by role", () => {
  it("moderator cannot end the show; TD can; moderator can hide chat; TD cannot", () => {
    expect(authorizeLiveControl({ crew: crew("moderator") }, "room-1", "go_live")).toEqual({ ok: false, error: crewDeniedReason("moderator", "go_live") });
    expect(authorizeLiveControl({ crew: crew("technical_director") }, "room-1", "go_live")).toMatchObject({ ok: true, actorRole: "crew", crewRole: "technical_director" });
    expect(authorizeLiveControl({ crew: crew("moderator") }, "room-1", "moderate_chat")).toMatchObject({ ok: true, crewRole: "moderator" });
    expect(authorizeLiveControl({ crew: crew("technical_director") }, "room-1", "moderate_chat")).toMatchObject({ ok: false });
  });

  it("owner and operator bypass the role table; the wrong event and no cookie are refused", () => {
    for (const action of DECK_ACTIONS) {
      expect(authorizeLiveControl({ owner }, "room-1", action)).toMatchObject({ ok: true, actorRole: "owner" });
      expect(authorizeLiveControl({ operator }, "room-1", action)).toMatchObject({ ok: true, actorRole: "operator" });
    }
    expect(authorizeLiveControl({ crew: crew("executive_producer", "room-2") }, "room-1", "go_live")).toMatchObject({ ok: false });
    expect(authorizeLiveControl({}, "room-1", "go_live")).toMatchObject({ ok: false });
    // A read (no action named) still needs some crew cookie, any role.
    expect(authorizeLiveControl({ crew: crew("crew") }, "room-1")).toMatchObject({ ok: true, actorRole: "crew" });
  });
});

describe("crew viewer (deck + badge)", () => {
  it("executive_producer crew cookie is the host with the full deck; plain crew is not", () => {
    const host = crewViewerFromPayloads({ crew: crew("executive_producer") }, "room-1");
    expect(host).toMatchObject({ kind: "crew", role: "executive_producer", isHost: true, label: "Executive Producer (host)" });
    for (const action of DECK_ACTIONS) expect(viewerCan(host, action), action).toBe(true);
    const plain = crewViewerFromPayloads({ crew: crew("crew") }, "room-1");
    expect(plain.isHost).toBe(false);
    for (const action of DECK_ACTIONS) expect(viewerCan(plain, action), action).toBe(false);
    expect(viewerDenied(plain, "go_live")).toBe(crewDeniedReason("crew", "go_live"));
  });

  it("an executive_producer cookie for another event is not the host here; owner and operator always are", () => {
    expect(crewViewerFromPayloads({ crew: crew("executive_producer", "room-2") }, "room-1")).toMatchObject({ kind: "none", isHost: false });
    expect(crewViewerFromPayloads({ owner }, "room-1")).toMatchObject({ kind: "owner", isHost: true, allowed: "all" });
    expect(crewViewerFromPayloads({ operator }, "room-1")).toMatchObject({ kind: "operator", isHost: true, allowed: "all" });
    expect(viewerDenied(crewViewerFromPayloads({ owner }, "room-1"), "go_live")).toBeUndefined();
  });

  it("the moderator's badge says what they may do and the deck disables the stream controls with the reason", () => {
    const moderator = crewViewerFromPayloads({ crew: crew("moderator") }, "room-1");
    expect(moderator.description).toMatch(/Cannot move the stream/);
    expect(viewerCan(moderator, "moderate_chat")).toBe(true);
    expect(viewerDenied(moderator, "go_live")).toMatch(/^Moderator can't move the stream or end the show/);
  });
});
