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

/** The masked form the People page shows for a row whose raw address was never kept. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "hidden";
  return `${name.slice(0, 2)}***@${domain}`;
}

/**
 * The one contact write, used by registration AND every profile save. Heal on match: rows for the
 * same person at other events that were registered before 16 Sep 2026 carry only the email hash
 * (email null), so no contact was ever built for them. When an incoming profile's hash matches
 * such rows, the email is backfilled onto ALL of them and the contact is built from their union:
 * events_attended = every event with that hash, first_seen = the earliest created_at.
 */
export async function upsertContactFromProfile(profile: AttendeeProfile) {
  const email = (profile.email || "").trim().toLowerCase();
  if (!email) return undefined;
  const store = getRuntimeStore();
  const siblings = profile.emailHash ? await store.listAttendeeProfilesByEmailHash(profile.emailHash).catch(() => [] as AttendeeProfile[]) : [];
  const healed: AttendeeProfile[] = [];
  for (const row of siblings) {
    if (row.email || (row.eventId === profile.eventId && row.attendeeId === profile.attendeeId)) continue;
    const backfilled: AttendeeProfile = { ...row, email, emailMasked: row.emailMasked || maskEmail(email), updatedAt: new Date().toISOString() };
    await store.upsertAttendeeProfile(backfilled).catch(() => undefined);
    healed.push(backfilled);
  }
  const existing = await store.getContact(email).catch(() => undefined);
  const merged = mergeContact(existing, profile);
  if (!merged) return undefined;
  const union = [profile, ...siblings];
  merged.eventsAttended = Array.from(new Set([...merged.eventsAttended, ...union.map((row) => row.eventId)]));
  // Details the new registration left blank come from the healed rows (the union), not from nowhere.
  const latestFirst = siblings.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (!merged.title) merged.title = latestFirst.find((row) => row.title)?.title || "";
  if (!merged.company) merged.company = latestFirst.find((row) => row.company)?.company || "";
  if (!merged.name) merged.name = latestFirst.find((row) => row.name)?.name || "";
  const earliest = union.map((row) => row.createdAt).filter(Boolean).sort()[0];
  if (earliest && (!existing?.firstSeenAt || earliest < existing.firstSeenAt)) merged.firstSeenAt = earliest;
  const saved = await store.upsertContact(merged).catch(() => undefined);
  return saved ? { ...saved, healedRows: healed.length } : undefined;
}

export async function listContacts() {
  return getRuntimeStore().listContacts();
}

/** One person the People page shows from hash-only rows (registered before the raw email was kept). */
export interface HashOnlyPerson {
  emailHash: string;
  emailMasked: string;
  name: string;
  company: string;
  title: string;
  hiddenFromDirectory: boolean;
  events: { id: string; name: string }[];
  firstSeenAt: string;
  lastSeenAt: string;
}

/** Pure grouping (exported for the tests): hash-only rows → one person per hash across events, latest details win. */
export function groupHashOnlyProfiles(rows: AttendeeProfile[], eventNames: Record<string, string> = {}): HashOnlyPerson[] {
  const byHash = new Map<string, HashOnlyPerson>();
  for (const row of rows.slice().sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")))) {
    if (row.email || !row.emailHash) continue;
    const current = byHash.get(row.emailHash);
    const event = { id: row.eventId, name: eventNames[row.eventId] || row.eventId };
    if (!current) {
      byHash.set(row.emailHash, { emailHash: row.emailHash, emailMasked: row.emailMasked || "hidden", name: row.name, company: row.company, title: row.title, hiddenFromDirectory: Boolean(row.hiddenFromDirectory), events: [event], firstSeenAt: row.createdAt, lastSeenAt: row.updatedAt || row.createdAt });
      continue;
    }
    current.name = row.name || current.name;
    current.company = row.company || current.company;
    current.title = row.title || current.title;
    current.emailMasked = row.emailMasked || current.emailMasked;
    if (!current.events.some((item) => item.id === event.id)) current.events.push(event);
    if (row.createdAt && row.createdAt < current.firstSeenAt) current.firstSeenAt = row.createdAt;
    if ((row.updatedAt || "") > current.lastSeenAt) current.lastSeenAt = row.updatedAt;
  }
  return Array.from(byHash.values()).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/** People whose registration predates the raw email: listed below the contacts, never silently missing. */
export async function listHashOnlyPeople(eventNames: Record<string, string> = {}) {
  const rows = await getRuntimeStore().listAttendeeProfilesWithoutEmail().catch(() => [] as AttendeeProfile[]);
  return groupHashOnlyProfiles(rows, eventNames);
}

export const EMAIL_NOT_CAPTURED_NOTE = "not captured — registered before 16 Sep 2026";

/** CSV for the owner: contacts first, then the hash-only people with a blank email column. */
export function contactsCsv(contacts: ContactRecord[], hashOnly: HashOnlyPerson[] = []) {
  const cell = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = [["name", "email", "company", "title", "events_count", "hide_from_directory", "first_seen_at", "last_seen_at"].join(",")];
  for (const contact of contacts) rows.push([contact.name, contact.email, contact.company, contact.title, contact.eventsAttended.length, contact.hiddenFromDirectory, contact.firstSeenAt, contact.lastSeenAt].map(cell).join(","));
  for (const person of hashOnly) rows.push([person.name, "", person.company, person.title, person.events.length, person.hiddenFromDirectory, person.firstSeenAt, person.lastSeenAt].map(cell).join(","));
  return `${rows.join("\n")}\n`;
}
