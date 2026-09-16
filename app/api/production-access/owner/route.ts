import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret, matchOwnerMasterPassword } from "@/lib/env";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { redirectTo, safeAccessRedirectTarget } from "@/lib/auth/accessGateResponse";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const safeNext = safeAccessRedirectTarget(String(formData.get("next") ?? "/app"), "/app");
  const env = getEnv();

  const ownerKey = matchOwnerMasterPassword(password, env);
  if (!ownerKey) {
    await logAccessAttempt({ status: "access_denied", accessKind: "owner", role: "owner", reason: "invalid_password", route: "/production-access/owner" });
    return redirectTo(request, "/production-access/owner?error=invalid");
  }

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
