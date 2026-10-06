import { NextResponse } from "next/server";
import { safeAccessCookieNames } from "@/lib/env/safeEnv";
import { isPrefetchRequest } from "@/lib/http/prefetch";

export const dynamic = "force-dynamic";

/** Logs out of every access door, on a real navigation only (see isPrefetchRequest). */
export async function GET(request: Request) {
  if (isPrefetchRequest(request.headers)) return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
  const { crewCookieName, specialGuestCookieName, operatorCookieName, ownerCookieName } = safeAccessCookieNames();
  const response = NextResponse.redirect(new URL("/production-access", request.url));
  response.headers.set("cache-control", "no-store");
  response.cookies.delete(crewCookieName);
  response.cookies.delete(specialGuestCookieName);
  response.cookies.delete(operatorCookieName);
  response.cookies.delete(ownerCookieName);
  return response;
}
