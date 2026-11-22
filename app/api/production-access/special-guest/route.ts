import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { missingAccessEnv } from "@/lib/env/safeEnv";
import { redirectTo } from "@/lib/auth/accessGateResponse";
import { gateScopeForEventCode, resolveSpecialGuestAccess } from "@/services/access/eventAccessResolver";
import { supersededGateQuery } from "@/components/access/SupersededGateNotice";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { gateRefusalQuery, requestIpHash, takeGateAttempt } from "@/services/access/gateAttemptLimiter";
import type { V4SpecialGuestRole } from "@/types/v4";
import { getAccessCodeVersions } from "@/services/events/accessCodeService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (missingAccessEnv().includes("V5_ACCESS_COOKIE_SECRET")) return redirectTo(request, "/production-access/setup-error");
  const formData = await request.formData();
  const eventCode = String(formData.get("eventCode") ?? "");
  const roleCode = String(formData.get("roleCode") ?? "");

  const { ip, ipHash } = await requestIpHash(request);
  const gate = await takeGateAttempt({ ip, scope: await gateScopeForEventCode(eventCode), gate: "special_guest" });
  if (!gate.allowed) {
    await logAccessAttempt({ status: "access_denied", accessKind: "special_guest", eventId: eventCode || undefined, role: "unknown", reason: gate.reason === "too_many" ? "rate_limited" : "rate_limiter_unavailable", route: "/production-access/special-guest", ipHash });
    return redirectTo(request, `/production-access/special-guest?${gateRefusalQuery(gate)}`);
  }

  // This door fails open in an outage, so it never takes a production password: the owner previews
  // guests from the owner console (/production-access/special-guest/preview), not from here.
  const access = await resolveSpecialGuestAccess(eventCode, roleCode);
  if (!access.ok || !access.destination || !access.eventId || !access.role) {
    await logAccessAttempt({ status: "access_denied", accessKind: "special_guest", eventId: access.eventId || eventCode || undefined, role: String(access.role || "unknown"), reason: access.reason, route: "/production-access/special-guest", ipHash });
    // Refused either way; a code we rotated says which credential went and when.
    return redirectTo(request, `/production-access/special-guest?${supersededGateQuery(access) || `error=${access.reason ?? "invalid"}`}`);
  }

  const env = getEnv();
  const { specialGuestCookieName } = getV5AccessCookieNames(env);
  const role = access.role as V4SpecialGuestRole;
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
