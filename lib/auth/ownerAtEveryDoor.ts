import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret, matchOwnerMasterPassword, type OwnerMasterKey } from "@/lib/env";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import type { GateAttempt, GateName } from "@/services/access/gateAttemptLimiter";

/**
 * The owner password is accepted at every door (her ruling, 22 Nov 2026: "the owner password should
 * be accepted in every door"). Typed into any field that takes a secret, it signs her in as the
 * owner, with full access, and lands her where that door leads.
 *
 * Guessing stays bounded. Every door takes its attempt count first (per door, event and address, 6 a
 * minute), and the owner check reads that count's answer:
 *   · counted and allowed → the right password opens the door;
 *   · this address is over its count (6 misses in a minute) → refused like any try, for 60 s; a
 *     prober at another address never uses up hers;
 *   · the limiter itself is down → the right password still opens the door, logged as degraded;
 *     anything else is left to the door, which refuses it (production doors) or checks it as a
 *     guest code (guest doors).
 * A right password is one count like any try, so only a minute with six misses locks her out.
 *
 * Every gate the attempt limiter knows is listed here, so a new door has to say what it does.
 */
export const OWNER_PASSWORD_DOORS: Record<GateName, { file: string } | { file: string; noSecret: string }> = {
  owner: { file: "app/api/production-access/owner/route.ts" },
  operator: { file: "app/api/production-access/operator/route.ts" },
  crew: { file: "app/api/production-access/crew/route.ts" },
  special_guest: { file: "app/api/production-access/special-guest/route.ts" },
  vip_redeem: { file: "lib/actions/vipActions.ts" },
  login: { file: "lib/auth/actions.ts" },
  attendee_return: { file: "services/attendees/attendeeReturnService.ts", noSecret: "an attendee types only their email here; there is no secret field to type a password into" },
};

const OWNER_HOURS = 12;

function safeTarget(next: string | undefined, fallback: string) {
  const value = next || fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

async function ownerCookieFor(password: string, door: GateName, attempt: GateAttempt): Promise<{ name: string; value: string; key: OwnerMasterKey } | undefined> {
  const env = getEnv();
  // An address over its count gets no answer about the owner password either: that is what bounds guessing.
  if (!attempt.allowed && attempt.reason === "too_many") return undefined;
  const key = password ? matchOwnerMasterPassword(password, env) : undefined;
  if (!key) return undefined;
  const degraded = !attempt.allowed || attempt.degraded === true;
  if (degraded) console.error(`[owner-door] ${door}: limiter unavailable; the owner password was let in uncounted`);
  const value = await createV5AccessCookie({ kind: "owner", role: "owner", ownerKey: key, issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * OWNER_HOURS }, getV5AccessCookieSecret(env));
  await logAccessAttempt({ status: "access_granted", accessKind: "owner", role: "owner", reason: `owner_master:${key}:${door}${degraded ? ":degraded" : ""}`, route: OWNER_PASSWORD_DOORS[door].file }).catch(() => undefined);
  return { name: getV5AccessCookieNames(env).ownerCookieName, value, key };
}

/** For a gate route, called right after the count and before its refusal: the owner's redirect with her cookie when the password is hers, else undefined. */
export async function ownerSignInResponse(input: { request: NextRequest; password: string; door: GateName; attempt: GateAttempt; next?: string; fallback?: string }) {
  const cookie = await ownerCookieFor(input.password, input.door, input.attempt);
  if (!cookie) return undefined;
  const response = NextResponse.redirect(new URL(safeTarget(input.next, input.fallback || "/app/owner"), input.request.url), 303);
  response.cookies.set(cookie.name, cookie.value, getV5CookieOptions(60 * 60 * OWNER_HOURS));
  return response;
}

/** For a server-action door, called right after the count and before its refusal: sets her cookie and redirects (never returns) when the password is hers. */
export async function ownerSignInRedirect(input: { password: string; door: GateName; attempt: GateAttempt; next?: string; fallback?: string }) {
  const cookie = await ownerCookieFor(input.password, input.door, input.attempt);
  if (!cookie) return;
  (await cookies()).set(cookie.name, cookie.value, getV5CookieOptions(60 * 60 * OWNER_HOURS));
  redirect(safeTarget(input.next, input.fallback || "/app/owner"));
}
