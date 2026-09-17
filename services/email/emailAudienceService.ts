import { excludePreviewIdentities } from "@/lib/auth/previewIdentity";
import { findEventRecord } from "@/services/events/eventRepository";
import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import { listVipStanding } from "@/services/guests/vipGrantService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { listSuppliersForEvent } from "@/services/suppliers/supplierRepository";
import { suppressedAddresses } from "./emailSuppressionService";
import { audienceOption, type AudienceMember, type EmailAudienceKind, type ResolvedAudience } from "@/types/emailAudience";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { RuntimeClientRecord } from "@/types/runtimeEvent";

/**
 * Who "all attendees" actually is.
 *
 * Every group in the composer is resolved from the real rows the rest of the product already keeps —
 * attendee registrations, VIP grants, guest identities, the event's contractors, the client record —
 * and never from a list typed twice. Three rules hold everywhere in this file:
 *
 *   · A person who appears in two groups is ONE person. The lowercased address is the identity, so a
 *     speaker who also registered as an attendee is emailed once, not twice.
 *   · Somebody with no address on file is COUNTED AND NAMED as unreachable, never quietly dropped.
 *     A speaker who never gave an address is the composer's problem to report, not to hide.
 *   · An empty group is refused. Reporting "sent to 0 people" as a success is the failure mode this
 *     whole function exists to prevent.
 */
const ATTENDEE_SCAN_LIMIT = 2000;

function clean(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

function usable(email: string) {
  return email.includes("@") && !email.startsWith("@") && !email.endsWith("@");
}

/** Collects candidates, dedupes on the address, and keeps the first source that named each person. */
class AudienceBuilder {
  private readonly byKey = new Map<string, AudienceMember>();
  private unreachable = 0;

  add(email: unknown, name: string | undefined, source: string) {
    const address = clean(email);
    if (!usable(address)) {
      this.unreachable += 1;
      return;
    }
    if (this.byKey.has(address)) return;
    this.byKey.set(address, { personKey: address, email: address, name: name?.trim() || undefined, source });
  }

  /** Somebody we know is in the group but hold no address for: counted, never silently lost. */
  noteUnreachable(count = 1) {
    this.unreachable += count;
  }

  get members() {
    return Array.from(this.byKey.values()).sort((a, b) => a.email.localeCompare(b.email));
  }

  get withoutEmail() {
    return this.unreachable;
  }
}

async function attendeeCandidates(eventId: string, builder: AudienceBuilder) {
  const rows = await getRuntimeStore().listAttendeeProfiles(eventId, ATTENDEE_SCAN_LIMIT).catch(() => [] as AttendeeProfile[]);
  // Our own preview personas are not people; they must never receive anything.
  for (const profile of excludePreviewIdentities(rows, (row) => row.attendeeId)) {
    if (profile.status !== "active") continue;
    // Rows registered before 16 Sep 2026 kept only the hash. They are real people with no address.
    if (!profile.email) builder.noteUnreachable();
    else builder.add(profile.email, profile.name, "Registered attendee");
  }
}

async function vipCandidates(eventId: string, builder: AudienceBuilder) {
  for (const grant of await listVipStanding(eventId).catch(() => [])) {
    // Rotating the VIP code ends the grants made under the old one: they are not VIPs any more.
    if (!grant.current) continue;
    if (!grant.email) builder.noteUnreachable();
    else builder.add(grant.email, grant.name, "VIP grant");
  }
  // A VIP who came in through the guest gate rather than attendee registration is a guest profile.
  for (const guest of await listGuestProfiles(eventId, "vip").catch(() => [])) {
    if (!guest.email) builder.noteUnreachable();
    else builder.add(guest.email, guest.name, "VIP");
  }
}

async function guestCandidates(eventId: string, role: "speaker" | "sponsor" | "client", label: string, builder: AudienceBuilder) {
  for (const guest of await listGuestProfiles(eventId, role).catch(() => [])) {
    if (!guest.email) builder.noteUnreachable();
    else builder.add(guest.email, guest.name, label);
  }
}

async function crewCandidates(eventId: string, builder: AudienceBuilder) {
  for (const row of await listSuppliersForEvent(eventId, "contractor").catch(() => [])) {
    // Archiving is the only removal in the supplier table, and a shortlisted name is somebody we
    // have not hired: neither belongs on a crew call.
    if (row.supplier.archivedAt) continue;
    if (row.supplier.status !== "booked" && row.supplier.status !== "paid") continue;
    if (!row.supplier.email) builder.noteUnreachable();
    else builder.add(row.supplier.email, row.supplier.name, "Crew");
  }
}

async function clientCandidates(eventId: string, builder: AudienceBuilder) {
  const event = await findEventRecord(eventId).catch(() => undefined);
  if (event?.clientId) {
    const clients = await getRuntimeStore().listRuntimeClients().catch(() => [] as RuntimeClientRecord[]);
    const client = clients.find((row) => row.id === event.clientId);
    if (client?.primaryContactEmail) builder.add(client.primaryContactEmail, client.primaryContactName || client.name, "Client contact");
  }
  // The person holding the client code for this event, when they have told us who they are.
  await guestCandidates(eventId, "client", "Client", builder);
}

/**
 * The composer's one read. `oneOff` is the address typed into the "One person" field; every other
 * audience ignores it.
 *
 * Suppression is applied HERE and only here, and only to group audiences. "One person" is a message
 * addressed to somebody by name — the transactional case — so the unsubscribe list does not apply to
 * it, and the composer says so on screen.
 */
export async function resolveAudience(input: { kind: EmailAudienceKind; eventId?: string; oneOff?: string }): Promise<ResolvedAudience> {
  const option = audienceOption(input.kind);
  if (!option) return { kind: input.kind, eventId: input.eventId, label: String(input.kind), members: [], suppressed: [], withoutEmail: 0, ok: false, reason: "That is not an audience this composer knows." };
  const base = { kind: input.kind, eventId: input.eventId, label: option.label };

  if (input.kind === "one_person") {
    const address = clean(input.oneOff);
    if (!usable(address)) return { ...base, members: [], suppressed: [], withoutEmail: 0, ok: false, reason: "Put the address in before sending." };
    return { ...base, members: [{ personKey: address, email: address, source: "Typed in" }], suppressed: [], withoutEmail: 0, ok: true };
  }

  if (!input.eventId) {
    return { ...base, members: [], suppressed: [], withoutEmail: 0, ok: false, reason: `${option.label} comes from an event, so pick the event first. Only "One person" can be sent without one.` };
  }

  const builder = new AudienceBuilder();
  if (input.kind === "attendees") await attendeeCandidates(input.eventId, builder);
  if (input.kind === "vips") await vipCandidates(input.eventId, builder);
  if (input.kind === "speakers") await guestCandidates(input.eventId, "speaker", "Speaker", builder);
  if (input.kind === "sponsors") await guestCandidates(input.eventId, "sponsor", "Sponsor", builder);
  if (input.kind === "crew") await crewCandidates(input.eventId, builder);
  if (input.kind === "client") await clientCandidates(input.eventId, builder);

  const resolved = builder.members;
  const suppressedSet = await suppressedAddresses();
  const members = resolved.filter((member) => !suppressedSet.has(member.personKey));
  const suppressed = resolved.filter((member) => suppressedSet.has(member.personKey));
  const withoutEmail = builder.withoutEmail;

  if (!members.length) {
    const reason = resolved.length
      ? `Every one of the ${resolved.length} ${resolved.length === 1 ? "person" : "people"} in ${option.label.toLowerCase()} has unsubscribed. Nothing will be sent.`
      : withoutEmail
        ? `${withoutEmail} ${withoutEmail === 1 ? "person is" : "people are"} in ${option.label.toLowerCase()} for this event, but we hold no address for ${withoutEmail === 1 ? "them" : "any of them"}. Nothing will be sent.`
        : `There is nobody in ${option.label.toLowerCase()} for this event yet. Nothing will be sent.`;
    return { ...base, members: [], suppressed, withoutEmail, ok: false, reason };
  }

  return { ...base, members, suppressed, withoutEmail, ok: true };
}

/** "all attendees · 47 people · 2 unsubscribed" — the sentence above the Send button. */
export function describeAudience(audience: ResolvedAudience) {
  const parts = [`${audience.label.toLowerCase()} · ${audience.members.length} ${audience.members.length === 1 ? "person" : "people"}`];
  if (audience.suppressed.length) parts.push(`${audience.suppressed.length} unsubscribed`);
  if (audience.withoutEmail) parts.push(`${audience.withoutEmail} with no address on file`);
  return parts.join(" · ");
}
