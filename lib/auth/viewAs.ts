import { cookies } from "next/headers";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { canViewAsGuest, type ViewAsViewer } from "@/lib/auth/viewAsGuard";
import { isPreviewPersonaId, previewPersona } from "@/lib/auth/previewIdentity";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";

export interface ViewAsContext {
  guest: SpecialGuestProfile;
  viewer: Extract<ViewAsViewer, { ok: true }>;
  /** Set when the "guest" is a synthetic persona rather than a stored profile. */
  preview?: boolean;
}

/**
 * Reads the three access cookies once and applies the one rule. Shared with the preview resolver so
 * a persona and a real guest are admitted by exactly the same people.
 */
export async function readViewAsViewer(eventId: string): Promise<ViewAsViewer> {
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
    return canViewAsGuest({ owner, operator, crew }, eventId);
  } catch {
    return { ok: false };
  }
}

/**
 * "View as" for a guest page: when `?viewAs=` is present AND the caller holds an owner, operator, or
 * producer cookie for the event, the page renders THAT identity's real state (read-mostly, actions
 * disabled, banner on top). Anyone else gets undefined and the page renders as itself — the
 * parameter is simply ignored for attendees and other guests.
 *
 * The value is either a stored guest id, or a `preview-` persona. A persona has no stored profile on
 * purpose: a guest row only exists after a real human entered a role code and typed their name, so
 * on a fresh event — the exact moment you want to check what a speaker will see — there was nobody
 * to view as. The persona is synthesised here and reads the event's real configuration everywhere
 * else; `refusePreviewWrite` keeps it from saving anything.
 */
export async function resolveViewAs(eventId: string, viewAs: string | undefined, role: SpecialGuestRole): Promise<ViewAsContext | undefined> {
  const guestId = String(viewAs || "").trim();
  if (!guestId) return undefined;
  const viewer = await readViewAsViewer(eventId);
  if (!viewer.ok) return undefined;
  if (isPreviewPersonaId(guestId)) {
    const persona = previewPersona(guestId);
    if (!persona || persona.role !== role) return undefined;
    return { guest: syntheticGuestProfile(eventId, guestId, role, persona.name), viewer, preview: true };
  }
  try {
    const guest = await getRuntimeStore().getSpecialGuestProfile(eventId, guestId).catch(() => undefined);
    if (!guest || guest.role !== role) return undefined;
    return { guest, viewer };
  } catch {
    return undefined;
  }
}

/** A persona shaped like a guest so every guest page renders it unchanged. Never stored. */
function syntheticGuestProfile(eventId: string, guestId: string, role: SpecialGuestRole, name: string): SpecialGuestProfile {
  const now = new Date().toISOString();
  return { guestId, eventId, role, name, company: "Preview", title: "Preview", createdAt: now, updatedAt: now };
}
