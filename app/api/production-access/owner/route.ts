import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret, matchOwnerMasterPassword } from "@/lib/env";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { redirectTo, safeAccessRedirectTarget } from "@/lib/auth/accessGateResponse";
import { checkGateAttempts, clearGateAttempts, gateAttemptKeyFor, recordGateFailure, requestIpHash } from "@/services/access/gateAttemptLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const safeNext = safeAccessRedirectTarget(String(formData.get("next") ?? "/app/owner"), "/app/owner");
  const env = getEnv();

  // The master password names its own door (owner-access-2027!), so it is guessable by design and
  // the gate is where that is paid for. This one opens every event, so it is limited hardest.
  const { ip, ipHash } = await requestIpHash(request);
  const attemptKey = gateAttemptKeyFor({ ip, gate: "owner" });
  const gate = checkGateAttempts(attemptKey);
  if (!gate.allowed) {
    await logAccessAttempt({ status: "access_denied", accessKind: "owner", role: "owner", reason: "rate_limited", route: "/production-access/owner", ipHash });
    return redirectTo(request, `/production-access/owner?error=too_many&retry=${gate.retryInSeconds}`);
  }

  const ownerKey = matchOwnerMasterPassword(password, env);
  if (!ownerKey) {
    const limit = recordGateFailure(attemptKey);
    await logAccessAttempt({ status: "access_denied", accessKind: "owner", role: "owner", reason: limit.cooling ? "rate_limited_after_failures" : "invalid_password", route: "/production-access/owner", ipHash });
    if (limit.cooling) return redirectTo(request, `/production-access/owner?error=too_many&retry=${limit.retryInSeconds}`);
    return redirectTo(request, "/production-access/owner?error=invalid");
  }
  clearGateAttempts(attemptKey);

  const { ownerCookieName } = getV5AccessCookieNames(env);
  const cookie = await createV5AccessCookie({
    kind: "owner",
    role: "owner",
    ownerKey,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  }, getV5AccessCookieSecret(env));

  await logAccessAttempt({ status: "access_granted", accessKind: "owner", role: "owner", reason: `owner_master:${ownerKey}`, route: safeNext });
  const response = redirectTo(request, safeNext);
  response.cookies.set(ownerCookieName, cookie, getV5CookieOptions(60 * 60 * 12));
  return response;
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/production-access/owner", request.url), 303);
}
