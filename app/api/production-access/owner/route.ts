import { NextResponse, type NextRequest } from "next/server";
import { ownerSignInResponse } from "@/lib/auth/ownerAtEveryDoor";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { redirectTo, safeAccessRedirectTarget } from "@/lib/auth/accessGateResponse";
import { gateRefusalQuery, requestIpHash, takeGateAttempt } from "@/services/access/gateAttemptLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const safeNext = safeAccessRedirectTarget(String(formData.get("next") ?? "/app/owner"), "/app/owner");

  // Counted first; the owner check reads the count (ownerAtEveryDoor): six misses from one address
  // lock that address for a minute, and in a limiter outage the right password still opens.
  const { ip, ipHash } = await requestIpHash(request);
  const gate = await takeGateAttempt({ ip, gate: "owner" });
  const owner = await ownerSignInResponse({ request, password, door: "owner", attempt: gate, next: safeNext, fallback: "/app/owner" });
  if (owner) return owner;
  if (!gate.allowed) {
    await logAccessAttempt({ status: "access_denied", accessKind: "owner", role: "owner", reason: gate.reason === "too_many" ? "rate_limited" : "rate_limiter_unavailable", route: "/production-access/owner", ipHash });
    return redirectTo(request, `/production-access/owner?${gateRefusalQuery(gate)}`);
  }
  await logAccessAttempt({ status: "access_denied", accessKind: "owner", role: "owner", reason: "invalid_password", route: "/production-access/owner", ipHash });
  return redirectTo(request, "/production-access/owner?error=invalid");
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/production-access/owner", request.url), 303);
}
