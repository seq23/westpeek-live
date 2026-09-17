import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { assertSeparatedProductionPasswords, getEnv, getOperatorLaunchpadPassword, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { missingAccessEnv } from "@/lib/env/safeEnv";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { ownerOverrideResponseIfMatched, redirectTo, safeAccessRedirectTarget } from "@/lib/auth/accessGateResponse";
import { checkGateAttempts, clearGateAttempts, gateAttemptKeyFor, recordGateFailure, requestIpHash } from "@/services/access/gateAttemptLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (missingAccessEnv().length) return redirectTo(request, "/production-access/setup-error");
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const safeNext = safeAccessRedirectTarget(String(formData.get("next") ?? "/production-access/launchpad"), "/production-access/launchpad");
  const env = getEnv();
  assertSeparatedProductionPasswords(env);

  // Same bargain as the crew gate: the password names its door, so the gate does the defending.
  const { ip, ipHash } = await requestIpHash(request);
  const attemptKey = gateAttemptKeyFor({ ip, gate: "operator" });
  const gate = checkGateAttempts(attemptKey);
  if (!gate.allowed) {
    await logAccessAttempt({ status: "access_denied", accessKind: "operator", role: "executive_producer", reason: "rate_limited", route: "/production-access/operator", ipHash });
    return redirectTo(request, `/production-access/operator?error=too_many&retry=${gate.retryInSeconds}`);
  }

  const ownerOverride = await ownerOverrideResponseIfMatched({ request, password, route: "/production-access/operator", next: safeNext, fallback: "/production-access/launchpad" });
  if (ownerOverride) { clearGateAttempts(attemptKey); return ownerOverride; }

  if (!password || password !== getOperatorLaunchpadPassword(env)) {
    const limit = recordGateFailure(attemptKey);
    await logAccessAttempt({ status: "access_denied", accessKind: "operator", role: "executive_producer", reason: limit.cooling ? "rate_limited_after_failures" : "invalid_password", route: "/production-access/operator", ipHash });
    if (limit.cooling) return redirectTo(request, `/production-access/operator?error=too_many&retry=${limit.retryInSeconds}`);
    return redirectTo(request, "/production-access/operator?error=invalid");
  }
  clearGateAttempts(attemptKey);

  await logAccessAttempt({ status: "access_granted", accessKind: "operator", eventId: "event-summit", role: "executive_producer", route: safeNext });
  const { operatorCookieName } = getV5AccessCookieNames(env);
  const cookie = await createV5AccessCookie({ kind: "operator", role: "executive_producer", issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 8 }, getV5AccessCookieSecret(env));
  const response = redirectTo(request, safeNext);
  response.cookies.set(operatorCookieName, cookie, getV5CookieOptions(60 * 60 * 8));
  return response;
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/production-access/operator", request.url), 303);
}
