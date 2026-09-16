import { NextRequest, NextResponse } from "next/server";
import { getAuthCookieName, getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { isProtectedPath } from "@/lib/auth/routeAccess";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { canCrewAccessPath, canOperatorAccessPath, canOwnerAccessPath, canSpecialGuestAccessPath, canViewAsAccessPath, specialGuestEntryPathFor } from "@/lib/auth/v5RouteAuthorization";

async function readCrewAccess(request: NextRequest) {
  try {
    const env = getEnv();
    const { crewCookieName } = getV5AccessCookieNames(env);
    return readV5AccessCookie(request.cookies.get(crewCookieName)?.value, getV5AccessCookieSecret(env));
  } catch {
    return undefined;
  }
}

async function readOperatorAccess(request: NextRequest) {
  try {
    const env = getEnv();
    const { operatorCookieName } = getV5AccessCookieNames(env);
    return readV5AccessCookie(request.cookies.get(operatorCookieName)?.value, getV5AccessCookieSecret(env));
  } catch {
    return undefined;
  }
}

async function readOwnerAccess(request: NextRequest) {
  try {
    const env = getEnv();
    const { ownerCookieName } = getV5AccessCookieNames(env);
    return readV5AccessCookie(request.cookies.get(ownerCookieName)?.value, getV5AccessCookieSecret(env));
  } catch {
    return undefined;
  }
}

async function readSpecialGuestAccess(request: NextRequest) {
  try {
    const env = getEnv();
    const { specialGuestCookieName } = getV5AccessCookieNames(env);
    return readV5AccessCookie(request.cookies.get(specialGuestCookieName)?.value, getV5AccessCookieSecret(env));
  } catch {
    return undefined;
  }
}

/**
 * The Owner Console carries the gate passwords themselves (the owner asked for them there), so its
 * response is never cached anywhere — not the browser, not a proxy, not Cloudflare.
 */
function noStore(response: NextResponse, pathname: string) {
  if (pathname === "/app/owner" || pathname.startsWith("/app/owner/")) response.headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  let sessionCookie: string | undefined;
  try { sessionCookie = request.cookies.get(getAuthCookieName())?.value; } catch { sessionCookie = undefined; }
  if (sessionCookie && (pathname.startsWith("/app") || pathname.startsWith("/admin"))) return noStore(NextResponse.next(), pathname);

  const ownerAccess = await readOwnerAccess(request);
  if (canOwnerAccessPath(pathname, ownerAccess)) return noStore(NextResponse.next(), pathname);

  const operatorAccess = await readOperatorAccess(request);
  if (canOperatorAccessPath(pathname, operatorAccess)) return NextResponse.next();

  const crewAccess = await readCrewAccess(request);
  if (canCrewAccessPath(pathname, crewAccess)) return NextResponse.next();

  const specialGuestAccess = await readSpecialGuestAccess(request);
  if (canSpecialGuestAccessPath(pathname, specialGuestAccess)) return NextResponse.next();

  // "View as" a guest: an operator or a producer opening a speaker / sponsor / client page as that guest.
  if (canViewAsAccessPath(pathname, request.nextUrl.searchParams.get("viewAs"), { owner: ownerAccess, operator: operatorAccess, crew: crewAccess })) return NextResponse.next();

  const loginUrl = new URL(specialGuestEntryPathFor(pathname), request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/app/:path*", "/manual", "/admin/:path*", "/billing", "/billing/:path*", "/client/:path*", "/crew/:path*", "/speaker/:path*", "/sponsor/:path*"],
};
