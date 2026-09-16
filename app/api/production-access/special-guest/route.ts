import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { missingAccessEnv } from "@/lib/env/safeEnv";
import { ownerOverrideResponseIfMatched, redirectTo } from "@/lib/auth/accessGateResponse";
import { resolveSpecialGuestAccess } from "@/services/access/eventAccessResolver";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { checkGateAttempts, clearGateAttempts, gateAttemptKeyFor, recordGateFailure, requestIpHash } from "@/services/access/gateAttemptLimiter";
import type { V4SpecialGuestRole } from "@/types/v4";
import { getAccessCodeVersions } from "@/services/events/accessCodeService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (missingAccessEnv().includes("V5_ACCESS_COOKIE_SECRET")) return redirectTo(request, "/production-access/setup-error");
  const formData = await request.formData();
  const eventCode = String(formData.get("eventCode") ?? "");
  const roleCode = String(formData.get("roleCode") ?? "");

  const { ip, ipHash } = await requestIpHash(request);
  const attemptKey = gateAttemptKeyFor({ ip, eventCode, gate: "special_guest" });
  const gate = checkGateAttempts(attemptKey);
  if (!gate.allowed) {
    await logAccessAttempt({ status: "access_denied", accessKind: "special_guest", eventId: eventCode || undefined, role: "unknown", reason: "rate_limited", route: "/production-access/special-guest", ipHash });
    return redirectTo(request, `/production-access/special-guest?error=too_many&retry=${gate.retryInSeconds}`);
  }

  // The owner master password here lands on "Preview a guest" for the typed event code, not the workspace.
  const ownerOverride = await ownerOverrideResponseIfMatched({ request, password: roleCode, route: "/production-access/special-guest", next: `/production-access/special-guest/preview?event=${encodeURIComponent(eventCode)}`, fallback: "/production-access/special-guest/preview" });
  if (ownerOverride) { clearGateAttempts(attemptKey); return ownerOverride; }

  const access = await resolveSpecialGuestAccess(eventCode, roleCode);
  if (!access.ok || !access.destination || !access.eventId || !access.role) {
    const limit = recordGateFailure(attemptKey);
    await logAccessAttempt({ status: "access_denied", accessKind: "special_guest", eventId: access.eventId || eventCode || undefined, role: String(access.role || "unknown"), reason: limit.cooling ? "rate_limited_after_failures" : access.reason, route: "/production-access/special-guest", ipHash });
    if (limit.cooling) return redirectTo(request, `/production-access/special-guest?error=too_many&retry=${limit.retryInSeconds}`);
    return redirectTo(request, `/production-access/special-guest?error=${access.reason ?? "invalid"}`);
  }

  const env = getEnv();
  const { specialGuestCookieName } = getV5AccessCookieNames(env);
  const role = access.role as V4SpecialGuestRole;
  clearGateAttempts(attemptKey);
  await logAccessAttempt({ status: "access_granted", accessKind: "special_guest", eventId: access.eventId, role, route: access.destination, ipHash });
  const codeVersion = role === "crew_lite" ? undefined : (await getAccessCodeVersions(access.eventId))[role];
  const cookie = await createV5AccessCookie({ kind: "special_guest", eventId: access.eventId, clientSlug: access.clientSlug, role, codeVersion, issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 12 }, getV5AccessCookieSecret(env));
  const response = redirectTo(request, access.destination);
  response.cookies.set(specialGuestCookieName, cookie, getV5CookieOptions(60 * 60 * 12));
  return response;
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/production-access/special-guest", request.url), 303);
}
