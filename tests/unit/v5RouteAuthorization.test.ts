import { describe, expect, it } from "vitest";
import { canCrewAccessPath, canOperatorAccessPath, canOwnerAccessPath, canSpecialGuestAccessPath, eventIdFromPath } from "@/lib/auth/v5RouteAuthorization";
import type { V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import type { V4SpecialGuestRole } from "@/types/v4";

const issuedAt = Date.now();
const expiresAt = issuedAt + 1000 * 60;

function guest(role: V4SpecialGuestRole, eventId = "event-1", clientSlug?: string): V5AccessCookiePayload {
  return { kind: "special_guest", role, eventId, clientSlug, issuedAt, expiresAt };
}

it("extracts exact event IDs from app, portal, and venue routes", () => {
  expect(eventIdFromPath("/app/events/event-1/publish")).toBe("event-1");
  expect(eventIdFromPath("/client/acme/events/event-1/assets")).toBe("event-1");
  expect(eventIdFromPath("/venue/event-1/lobby")).toBe("event-1");
});

it("does not authorize event-1 cookies on event-12 routes", () => {
  expect(canSpecialGuestAccessPath("/speaker/events/event-12", guest("speaker", "event-1"))).toBe(false);
  expect(canCrewAccessPath("/crew/events/event-12", { kind: "crew", role: "crew", eventId: "event-1", issuedAt, expiresAt })).toBe(false);
});

it("denies role escalation between special guest portals", () => {
  expect(canSpecialGuestAccessPath("/sponsor/events/event-1", guest("speaker"))).toBe(false);
  expect(canSpecialGuestAccessPath("/client/acme/events/event-1", guest("sponsor"))).toBe(false);
  expect(canSpecialGuestAccessPath("/app/events/event-1", guest("vip"))).toBe(false);
});

it("allows only the correct event-scoped portal", () => {
  expect(canSpecialGuestAccessPath("/speaker/events/event-1/green-room", guest("speaker"))).toBe(true);
  expect(canSpecialGuestAccessPath("/venue/event-1/lobby", guest("vip"))).toBe(true);
});

it("scopes client special guest access by event and client slug when present", () => {
  expect(canSpecialGuestAccessPath("/client/acme/events/event-1", guest("client", "event-1", "acme"))).toBe(true);
  expect(canSpecialGuestAccessPath("/client/other-client/events/event-1", guest("client", "event-1", "acme"))).toBe(false);
  expect(canSpecialGuestAccessPath("/client/acme/events/event-2", guest("client", "event-1", "acme"))).toBe(false);
  expect(canSpecialGuestAccessPath("/client/legacy/events/event-1", guest("client", "event-1"))).toBe(true);
});


it("keeps crew and operator route permissions separate", () => {
  const crew = { kind: "crew" as const, role: "crew" as const, eventId: "event-1", issuedAt, expiresAt };
  const operator = { kind: "operator" as const, role: "executive_producer" as const, issuedAt, expiresAt };
  expect(canCrewAccessPath("/production-access/launchpad", crew)).toBe(false);
  expect(canOperatorAccessPath("/production-access/launchpad", operator)).toBe(true);
  expect(canOperatorAccessPath("/app/events/new", operator)).toBe(true);
});

it("allows operator to run Day 1 event operations without owner-only escalation", () => {
  const operator = { kind: "operator" as const, role: "executive_producer" as const, issuedAt, expiresAt };
  const allowedEventSurfaces = [
    "setup",
    "access",
    "agenda",
    "analytics",
    "approval-queue",
    "approvals",
    "assets",
    "attendee-flow",
    "branding",
    "builder",
    "change-control",
    "communications",
    "crew",
    "inbox",
    "incidents",
    "overview",
    "preview",
    "producer",
    "publish",
    "report",
    "run-of-show",
    "speakers",
    "sponsors",
    "talent",
    "tasks",
    "timeline",
    "vendors",
    "venue",
    "video-health",
    "video",
  ];

  for (const surface of allowedEventSurfaces) {
    expect(canOperatorAccessPath(`/app/events/event-1/${surface}`, operator), surface).toBe(true);
  }

  expect(canOperatorAccessPath("/app/events/event-1", operator)).toBe(true);
  expect(canOperatorAccessPath("/admin/testing/event-1", operator)).toBe(true);
  expect(canOperatorAccessPath("/crew/events/event-1", operator)).toBe(true);
  expect(canOperatorAccessPath("/billing", operator)).toBe(false);
  expect(canOperatorAccessPath("/app/settings", operator)).toBe(false);
  expect(canOperatorAccessPath("/speaker/events/event-1", operator)).toBe(false);
  expect(canOperatorAccessPath("/sponsor/events/event-1", operator)).toBe(false);
  expect(canOperatorAccessPath("/client/acme/events/event-1", operator)).toBe(false);
});


describe("owner route authorization", () => {
  const owner = { kind: "owner" as const, role: "owner" as const, issuedAt: Date.now(), expiresAt: Date.now() + 1000 };

  it("owner can access settings and use universal authority across operator, crew, speaker, sponsor, client, vip/venue, billing, app, and admin gates", () => {
    for (const route of [
      "/production-access/launchpad",
      "/app/settings",
      "/admin/testing/event-1",
      "/billing",
      "/crew/events/event-1",
      "/speaker/events/event-1",
      "/sponsor/events/event-1",
      "/client/acme/events/event-1",
      "/venue/event-1/stage",
      "/operator-packet",
    ]) {
      expect(canOwnerAccessPath(route, owner), route).toBe(true);
    }
  });

  it("operator cannot escalate into owner-only or special guest portals", () => {
    const operator = { kind: "operator" as const, issuedAt: Date.now(), expiresAt: Date.now() + 1000 };
    expect(canOperatorAccessPath("/app/settings", operator)).toBe(false);
    expect(canOperatorAccessPath("/billing", operator)).toBe(false);
    expect(canOperatorAccessPath("/speaker/events/event-1", operator)).toBe(false);
    expect(canOperatorAccessPath("/sponsor/events/event-1", operator)).toBe(false);
    expect(canOperatorAccessPath("/client/acme/events/event-1", operator)).toBe(false);
  });
});
