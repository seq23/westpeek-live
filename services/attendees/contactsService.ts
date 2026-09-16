import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { AttendeeProfile, ContactRecord } from "@/types/attendeeRegistration";

/**
 * One person across events. Upserted on every registration and profile save: a person who
 * re-registers at a new event updates their contact cleanly (events_attended grows) instead of
 * becoming a second person. Pure merge exported for the tests.
 */
export function mergeContact(existing: ContactRecord | undefined, profile: AttendeeProfile, now = new Date().toISOString()): ContactRecord | undefined {
  const email = (profile.email || "").trim().toLowerCase();
  if (!email) return undefined;
  const events = new Set(existing?.eventsAttended || []);
  events.add(profile.eventId);
  return {
    email,
    name: profile.name || existing?.name || "",
    company: profile.company || existing?.company || "",
    title: profile.title || existing?.title || "",
    personalWebsite: profile.personalWebsite || existing?.personalWebsite,
    socialLinks: profile.socialLinks?.length ? profile.socialLinks : existing?.socialLinks || [],
    topicsOfInterest: profile.topicsOfInterest?.length ? profile.topicsOfInterest : existing?.topicsOfInterest || [],
    networkingGoals: profile.networkingGoals || existing?.networkingGoals,
    hiddenFromDirectory: Boolean(profile.hiddenFromDirectory),
    eventsAttended: Array.from(events),
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
    updatedAt: now,
  };
}

export async function upsertContactFromProfile(profile: AttendeeProfile) {
  const email = (profile.email || "").trim().toLowerCase();
  if (!email) return undefined;
  const store = getRuntimeStore();
  const existing = await store.getContact(email).catch(() => undefined);
  const merged = mergeContact(existing, profile);
  if (!merged) return undefined;
  return store.upsertContact(merged).catch(() => undefined);
}

export async function listContacts() {
  return getRuntimeStore().listContacts();
}

/** CSV for the owner: name, email, company, title, events count, hide_from_directory. */
export function contactsCsv(contacts: ContactRecord[]) {
  const cell = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = [["name", "email", "company", "title", "events_count", "hide_from_directory", "first_seen_at", "last_seen_at"].join(",")];
  for (const contact of contacts) rows.push([contact.name, contact.email, contact.company, contact.title, contact.eventsAttended.length, contact.hiddenFromDirectory, contact.firstSeenAt, contact.lastSeenAt].map(cell).join(","));
  return `${rows.join("\n")}\n`;
}
