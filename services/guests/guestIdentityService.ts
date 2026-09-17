import { cookies } from "next/headers";
import { refusePreviewWrite } from "@/lib/auth/previewIdentity";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { randomId } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";

export const GUEST_IDENTITY_COOKIE = "wpl_guest_identity";
const IDENTITY_DAYS = 14;

function parseCookie(value?: string) {
  if (!value) return undefined;
  const firstDot = value.indexOf(".");
  if (firstDot < 1) return undefined;
  return { eventId: value.slice(0, firstDot), guestId: value.slice(firstDot + 1) };
}

/** The role the special-guest cookie grants for this event, or undefined. Owner/operator/crew cookies do not count here. */
export async function getCurrentSpecialGuestAccess(eventId: string): Promise<{ role: SpecialGuestRole; eventId: string } | undefined> {
  try {
    const env = getEnv();
    const { specialGuestCookieName } = getV5AccessCookieNames(env);
    const payload = await readV5AccessCookie((await cookies()).get(specialGuestCookieName)?.value, getV5AccessCookieSecret(env));
    if (payload?.kind !== "special_guest" || !payload.eventId || !payload.role) return undefined;
    if (payload.eventId !== eventId && !(payload.eventId === "demo" && eventId === "event-summit") && !(payload.eventId === "event-summit" && eventId === "demo")) return undefined;
    if (payload.role === "crew_lite") return undefined;
    return { role: payload.role, eventId };
  } catch {
    return undefined;
  }
}

/** The person behind the role code, once they have told us who they are. Scoped to the event and the role. */
export async function getCurrentGuestIdentity(eventId: string, role?: SpecialGuestRole): Promise<SpecialGuestProfile | undefined> {
  const parsed = parseCookie((await cookies()).get(GUEST_IDENTITY_COOKIE)?.value);
  if (!parsed || parsed.eventId !== eventId) return undefined;
  const profile = await getRuntimeStore().getSpecialGuestProfile(eventId, parsed.guestId).catch(() => undefined);
  if (!profile) return undefined;
  if (role && profile.role !== role) return undefined;
  return profile;
}

export function cleanGuestField(value: unknown, max = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** First entry: the guest gives name / company / title once. Re-entry with the cookie updates the same row. */
export async function registerGuestIdentity(input: { eventId: string; role: SpecialGuestRole; name: string; company?: string; title?: string; email?: string; existingGuestId?: string }) {
  refusePreviewWrite(input.existingGuestId, "become a stored guest");
  const name = cleanGuestField(input.name);
  if (!name) throw new Error("Your name is required.");
  const store = getRuntimeStore();
  const now = new Date().toISOString();
  const existing = input.existingGuestId ? await store.getSpecialGuestProfile(input.eventId, input.existingGuestId).catch(() => undefined) : undefined;
  const profile: SpecialGuestProfile = {
    guestId: existing?.guestId || randomId(input.role),
    eventId: input.eventId,
    role: input.role,
    name,
    company: cleanGuestField(input.company),
    title: cleanGuestField(input.title),
    // Blank leaves whatever address they gave last time alone: re-entry re-renders the form with
    // every field, and a guest tabbing past this one must not wipe the way the crew reaches them.
    email: cleanGuestField(input.email, 200).toLowerCase() || existing?.email,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await store.upsertSpecialGuestProfile(profile);
  (await cookies()).set(GUEST_IDENTITY_COOKIE, `${profile.eventId}.${profile.guestId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IDENTITY_DAYS * 24 * 60 * 60,
  });
  return profile;
}

export async function listGuestProfiles(eventId: string, role?: SpecialGuestRole) {
  return getRuntimeStore().listSpecialGuestProfiles(eventId, role);
}
