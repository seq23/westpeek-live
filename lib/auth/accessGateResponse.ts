import { NextResponse, type NextRequest } from "next/server";

export function safeAccessRedirectTarget(next: string | undefined, fallback = "/app") {
  const value = next || fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function redirectTo(request: NextRequest, path: string, status = 303) {
  return NextResponse.redirect(new URL(path, request.url), status);
}
