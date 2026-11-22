import { describe, expect, it } from "vitest";
import { canCrewAccessPath, canOperatorAccessPath } from "@/lib/auth/v5RouteAuthorization";
import { authorizeLiveControl } from "@/lib/auth/liveControlRequestGuard";

describe("crew/operator access flow", () => {
  it("keeps crew access limited to crew workspace routes", () => {
    const payload = { kind: "crew" as const, role: "crew" as const, issuedAt: Date.now(), expiresAt: Date.now() + 10000 };
    expect(canCrewAccessPath("/crew/events/event-summit", payload)).toBe(true);
    expect(canCrewAccessPath("/app/events/event-summit", payload)).toBe(false);
    expect(canCrewAccessPath("/admin/testing/event-summit", payload)).toBe(false);
  });

  it("enforces scoped crew event IDs", () => {
    const payload = { kind: "crew" as const, eventId: "event-summit", role: "crew" as const, issuedAt: Date.now(), expiresAt: Date.now() + 10000 };
    expect(canCrewAccessPath("/crew/events/event-summit", payload)).toBe(true);
    expect(canCrewAccessPath("/crew/events/event-summit-extra", payload)).toBe(false);
  });

  it("allows operator cookies to open launchpad and diagnostics but not self-serve account creation", () => {
    const payload = { kind: "operator" as const, role: "executive_producer" as const, issuedAt: Date.now(), expiresAt: Date.now() + 10000 };
    expect(canOperatorAccessPath("/production-access/launchpad", payload)).toBe(true);
    expect(canOperatorAccessPath("/admin/testing/event-summit", payload)).toBe(true);
    expect(canOperatorAccessPath("/app/events/event-summit/run-of-show", payload)).toBe(true);
    expect(canOperatorAccessPath("/app/events/new", payload)).toBe(true);
  });

  it("requires explicit role capability for fallback switching", () => {
    const support = { kind: "crew" as const, eventId: "event-summit", role: "support" as const, issuedAt: Date.now(), expiresAt: Date.now() + 10000 };
    const td = { kind: "crew" as const, eventId: "event-summit", role: "technical_director" as const, issuedAt: Date.now(), expiresAt: Date.now() + 10000 };
    expect(authorizeLiveControl({ crew: support }, "event-summit", "switch_video_fallback").ok).toBe(false);
    expect(authorizeLiveControl({ crew: td }, "event-summit", "switch_video_fallback").ok).toBe(true);
  });
});
