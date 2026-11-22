import { describe, expect, it } from "vitest";
import { authorizeLiveControl } from "@/lib/auth/liveControlRequestGuard";
import { createV5AccessCookie, readV5AccessCookie } from "@/lib/auth/productionAccess";
import { resolveCrewAccess } from "@/services/access/eventAccessResolver";
import type { V4CrewRole } from "@/types/v4";

const secret = "test-v5-cookie-secret-minimum-32-characters";

describe("crew capability login flow", () => {
  it("allows the real crew resolver to issue a technical director role that can operate fallback actions", async () => {
    const access = await resolveCrewAccess(undefined, "technical_director");
    expect(access.ok).toBe(true);
    expect(access.role).toBe("technical_director");
    const cookie = await createV5AccessCookie({ kind: "crew", eventId: access.eventId, role: access.role as V4CrewRole, issuedAt: Date.now(), expiresAt: Date.now() + 10000 }, secret);
    const payload = await readV5AccessCookie(cookie, secret);
    expect(authorizeLiveControl({ crew: payload }, access.eventId, "run_video_health_check").ok).toBe(true);
    expect(authorizeLiveControl({ crew: payload }, access.eventId, "switch_video_fallback").ok).toBe(true);
  });

  it("keeps support crew from switching video fallback", async () => {
    const access = await resolveCrewAccess(undefined, "support");
    const cookie = await createV5AccessCookie({ kind: "crew", role: access.role as V4CrewRole, issuedAt: Date.now(), expiresAt: Date.now() + 10000 }, secret);
    const payload = await readV5AccessCookie(cookie, secret);
    expect(authorizeLiveControl({ crew: payload }, undefined, "switch_video_fallback").ok).toBe(false);
    expect(authorizeLiveControl({ crew: payload }, undefined, "log_incident").ok).toBe(true);
  });
});
