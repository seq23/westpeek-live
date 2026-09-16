import { NextResponse, type NextRequest } from "next/server";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret, matchOwnerMasterPassword } from "@/lib/env";
import { logAccessAttempt } from "@/services/access/accessAuditService";

export function safeAccessRedirectTarget(next: string | undefined, fallback = "/app") {
  const value = next || fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function redirectTo(request: NextRequest, path: string, status = 303) {
  return NextResponse.redirect(new URL(path, request.url), status);
}

export async function ownerOverrideResponseIfMatched(input: {
  request: NextRequest;
  password: string;
  route: string;
  next?: string;
  fallback?: string;
}) {
  const env = getEnv();
  const ownerKey = matchOwnerMasterPassword(input.password, env);
  if (!ownerKey) return undefined;

  const { ownerCookieName } = getV5AccessCookieNames(env);
  const cookie = await createV5AccessCookie({
    kind: "owner",
    role: "owner",
    ownerKey,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  }, getV5AccessCookieSecret(env));

  await logAccessAttempt({
    status: "access_granted",
    accessKind: "owner",
    role: "owner",
    reason: `owner_master_override:${ownerKey}`,
    route: input.route,
  });

  const response = redirectTo(input.request, safeAccessRedirectTarget(input.next, input.fallback || "/app"));
  response.cookies.set(ownerCookieName, cookie, getV5CookieOptions(60 * 60 * 12));
  return response;
}
