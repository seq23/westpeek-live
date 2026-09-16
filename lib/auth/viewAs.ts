import { cookies } from "next/headers";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { canViewAsGuest, type ViewAsViewer } from "@/lib/auth/viewAsGuard";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";

export interface ViewAsContext {
  guest: SpecialGuestProfile;
  viewer: Extract<ViewAsViewer, { ok: true }>;
}

/**
 * "View as" for a guest page: when `?viewAs=<guestId>` is present AND the caller holds an owner,
 * operator, or producer cookie for the event, the page renders THAT guest's real state (read-mostly,
 * actions disabled, banner on top). Anyone else gets undefined and the page renders as itself —
 * the parameter is simply ignored for attendees and other guests.
 */
export async function resolveViewAs(eventId: string, viewAs: string | undefined, role: SpecialGuestRole): Promise<ViewAsContext | undefined> {
  const guestId = String(viewAs || "").trim();
  if (!guestId) return undefined;
  try {
    const env = getEnv();
    const names = getV5AccessCookieNames(env);
    const secret = getV5AccessCookieSecret(env);
    const jar = await cookies();
    const [owner, operator, crew] = await Promise.all([
      readV5AccessCookie(jar.get(names.ownerCookieName)?.value, secret),
      readV5AccessCookie(jar.get(names.operatorCookieName)?.value, secret),
      readV5AccessCookie(jar.get(names.crewCookieName)?.value, secret),
    ]);
    const viewer = canViewAsGuest({ owner, operator, crew }, eventId);
    if (!viewer.ok) return undefined;
    const guest = await getRuntimeStore().getSpecialGuestProfile(eventId, guestId).catch(() => undefined);
    if (!guest || guest.role !== role) return undefined;
    return { guest, viewer };
  } catch {
    return undefined;
  }
}
