import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { assertSeparatedProductionPasswords, getEnv, getOperatorLaunchpadPassword, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { missingAccessEnv } from "@/lib/env/safeEnv";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { redirectTo, safeAccessRedirectTarget } from "@/lib/auth/accessGateResponse";
import { ownerSignInResponse } from "@/lib/auth/ownerAtEveryDoor";
import { gateRefusalQuery, requestIpHash, takeGateAttempt } from "@/services/access/gateAttemptLimiter";

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
  const gate = await takeGateAttempt({ ip, gate: "operator" });
  // The owner password works here too, read against this count (ownerAtEveryDoor).
  const owner = await ownerSignInResponse({ request, password, door: "operator", attempt: gate, next: safeNext });
  if (owner) return owner;
  if (!gate.allowed) {
    await logAccessAttempt({ status: "access_denied", accessKind: "operator", role: "executive_producer", reason: gate.reason === "too_many" ? "rate_limited" : "rate_limiter_unavailable", route: "/production-access/operator", ipHash });
    return redirectTo(request, `/production-access/operator?${gateRefusalQuery(gate)}`);
  }

  if (!password || password !== getOperatorLaunchpadPassword(env)) {
    await logAccessAttempt({ status: "access_denied", accessKind: "operator", role: "executive_producer", reason: "invalid_password", route: "/production-access/operator", ipHash });
    return redirectTo(request, "/production-access/operator?error=invalid");
  }

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
