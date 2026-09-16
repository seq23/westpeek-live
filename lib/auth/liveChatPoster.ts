import { cookies } from "next/headers";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import type { LiveChatPosterClass } from "@/types/liveChat";

/**
 * Who is posting into chat, for the slow-mode exemptions — read from the cookies on the request,
 * never from a form field, so a hand-made post cannot claim to be the host.
 *
 *   "crew"     an owner, operator, or crew cookie for this event (the host holds one of these);
 *   "speaker"  a special-guest cookie minted for this event with the speaker role;
 *   "attendee" everyone else, including an unregistered caller.
 *
 * The flood guard does NOT consult this: it applies to everyone.
 */
export async function getLiveChatPosterClass(eventId: string): Promise<LiveChatPosterClass> {
  const crew = await requireLiveEventControlAccessForRequest(eventId).catch(() => ({ ok: false as const }));
  if (crew.ok) return "crew";
  try {
    const env = getEnv();
    const cookieStore = await cookies();
    const guest = await readV5AccessCookie(cookieStore.get(getV5AccessCookieNames(env).specialGuestCookieName)?.value, getV5AccessCookieSecret(env));
    if (guest?.kind === "special_guest" && guest.role === "speaker" && guest.eventId === eventId) return "speaker";
  } catch {
    // No readable cookie is simply an attendee.
  }
  return "attendee";
}
