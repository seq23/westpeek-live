import { cookies } from "next/headers";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import type { VideoParticipantRole } from "@/types/video";

/**
 * WATCHING IS OPEN. Everyone holding the link may watch and read chat; only taking part — posting,
 * networking, going on stage — needs a registration (the settled rule, 16 Sep 2026). A viewer with
 * no attendee session used to get a 403 here, so an unregistered person who followed a join link
 * sat on "Stage is getting ready" through the whole show. Callers that can serve a watch-only
 * token pass allowAnonymousViewer and then get `identity: undefined`; every other caller still
 * requires the session, and the ROUTE decides what an anonymous viewer is allowed to join.
 */
export async function authorizeVideoTokenRequest(input: { role: VideoParticipantRole; eventId: string; allowAnonymousViewer?: boolean }) {
  if (input.role === "attendee") {
    const identity = await getCurrentAttendeeIdentity(input.eventId).catch(() => undefined);
    if (!identity && !input.allowAnonymousViewer) return { ok: false as const, error: "Registered attendee session required for attendee video token." };
    return { ok: true as const, identity };
  }
  if (input.role === "observer") return { ok: true as const };
  const env = getEnv();
  const { operatorCookieName, specialGuestCookieName, crewCookieName } = getV5AccessCookieNames(env);
  const secret = getV5AccessCookieSecret(env);
  const cookieStore = await cookies();
  const [operator, specialGuest, crew] = await Promise.all([
    readV5AccessCookie(cookieStore.get(operatorCookieName)?.value, secret),
    readV5AccessCookie(cookieStore.get(specialGuestCookieName)?.value, secret),
    readV5AccessCookie(cookieStore.get(crewCookieName)?.value, secret),
  ]);
  if (operator?.kind === "operator") return { ok: true as const };
  if ((input.role === "producer" || input.role === "host") && crew?.kind === "crew" && (!crew.eventId || crew.eventId === input.eventId)) return { ok: true as const };
  if (input.role === "speaker" && specialGuest?.kind === "special_guest" && specialGuest.role === "speaker" && specialGuest.eventId === input.eventId) return { ok: true as const };
  if (input.role === "sponsor" && specialGuest?.kind === "special_guest" && specialGuest.role === "sponsor" && specialGuest.eventId === input.eventId) return { ok: true as const };
  return { ok: false as const, error: "Video publishing role is not authorized for this request." };
}
