import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { missingAccessEnv } from "@/lib/env/safeEnv";
import { ownerOverrideResponseIfMatched, redirectTo, safeAccessRedirectTarget } from "@/lib/auth/accessGateResponse";
import { resolveCrewAccess } from "@/services/access/eventAccessResolver";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { checkGateAttempts, clearGateAttempts, gateAttemptKeyFor, recordGateFailure, requestIpHash } from "@/services/access/gateAttemptLimiter";
import type { V4CrewRole } from "@/types/v4";
import { CREW_ROLES } from "@/lib/auth/crewRolePermissions";
import { getHostLinkState } from "@/services/events/hostLinkService";
import { getCrewAccessPassword } from "@/lib/env";

export const dynamic = "force-dynamic";

function normalizeCrewRole(value: FormDataEntryValue | null): V4CrewRole {
  const role = String(value || "crew");
  if (CREW_ROLES.includes(role as V4CrewRole)) return role as V4CrewRole;
  return "crew";
}

export async function POST(request: NextRequest) {
  if (missingAccessEnv().length) return redirectTo(request, "/production-access/setup-error");
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const eventCode = String(formData.get("eventCode") ?? "");
  const crewRole = normalizeCrewRole(formData.get("crewRole"));
  const safeNext = safeAccessRedirectTarget(String(formData.get("next") ?? ""), eventCode ? `/crew/events/${eventCode}` : "/crew/events/demo");
  const env = getEnv();

  // Readable codes are guessable by design; the gate is where that is paid for.
  const { ip, ipHash } = await requestIpHash(request);
  const attemptKey = gateAttemptKeyFor({ ip, eventCode, gate: "crew" });
  const gate = checkGateAttempts(attemptKey);
  if (!gate.allowed) {
    await logAccessAttempt({ status: "access_denied", accessKind: "crew", eventId: eventCode || undefined, role: crewRole, reason: "rate_limited", route: "/production-access/crew", ipHash });
    return redirectTo(request, `/production-access/crew?error=too_many&retry=${gate.retryInSeconds}`);
  }

  const ownerOverride = await ownerOverrideResponseIfMatched({ request, password, route: "/production-access/crew", next: safeNext, fallback: eventCode ? `/crew/events/${eventCode}` : "/crew/events/demo" });
  if (ownerOverride) { clearGateAttempts(attemptKey); return ownerOverride; }

  // The global crew password still opens every event; a runtime-created event's own crew code opens just that event.
  const access = await resolveCrewAccess(eventCode || undefined, crewRole, password || "");
  if (!access.ok) {
    const invalidPassword = access.reason === "invalid_password" || !password;
    const limit = recordGateFailure(attemptKey);
    // The role, the event and the time — never what they typed.
    await logAccessAttempt({ status: "access_denied", accessKind: "crew", eventId: access.eventId || eventCode || undefined, role: crewRole, reason: limit.cooling ? "rate_limited_after_failures" : access.reason || "invalid_password", route: "/production-access/crew", ipHash });
    if (limit.cooling) return redirectTo(request, `/production-access/crew?error=too_many&retry=${limit.retryInSeconds}`);
    return redirectTo(request, invalidPassword ? "/production-access/crew?error=invalid" : "/production-access/crew?error=invalid_event");
  }

  clearGateAttempts(attemptKey);
  await logAccessAttempt({ status: "access_granted", accessKind: "crew", eventId: access.eventId, role: access.role || crewRole, route: access.destination, ipHash });
  const { crewCookieName } = getV5AccessCookieNames(env);
  const viaEventCode = Boolean(access.eventId) && password !== (getCrewAccessPassword()?.trim() || "\u0000");
  const codeVersion = viaEventCode && access.eventId ? (await getHostLinkState(access.eventId)).codeVersion : undefined;
  const cookie = await createV5AccessCookie({ kind: "crew", eventId: access.eventId, role: crewRole, codeVersion, issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 8 }, getV5AccessCookieSecret(env));
  const response = redirectTo(request, access.destination || `/crew/events/${access.eventId || "demo"}`);
  response.cookies.set(crewCookieName, cookie, getV5CookieOptions(60 * 60 * 8));
  return response;
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/production-access/crew", request.url), 303);
}
