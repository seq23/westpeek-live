import type { AttendeeProfile, ContactRecord } from "@/types/attendeeRegistration";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * Our own fixtures are not the owner's network. On 16 Sep 2026 /app/people showed 40 people of whom
 * 34 were Playwright and Tier-4 rows ("Tier 4 Browser Event Goer", fourteen `outcome-<ts>@example.com`
 * registrations — every run mints a NEW address, so they are genuinely distinct people, not a
 * grouping bug). A person is a test row when their address is at a reserved test domain, or when
 * every event they appear at is a seed/demo/automation event. Computed, never a name list.
 */
const TEST_DOMAINS = ["example.com", "example.invalid", "example.org", "example.net", "test.invalid", "localhost"];

export function isTestEmail(email?: string) {
  const domain = (email || "").trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return TEST_DOMAINS.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
}

/** The masked form keeps the domain ("ou***@example.com"), so a row with no raw email is still classifiable. */
export function isTestMaskedEmail(masked?: string) {
  return isTestEmail(masked);
}

const AUTOMATION_PREFIXES = ["playwright-", "tier4-auto-", "tier4-", "e2e-", "throwaway-", "smoke-"];

/** An event nobody created through /app/events/new: a compiled seed/demo event or one an automation run made. */
export function isTestEvent(event: Pick<RuntimeEventRecord, "id" | "name" | "source" | "createdBy"> | undefined, seedIds: Set<string> = new Set()) {
  if (!event) return false;
  const id = (event.id || "").toLowerCase();
  const name = (event.name || "").toLowerCase();
  if (seedIds.has(event.id) || event.source === "seed") return true;
  if (event.createdBy === "tier4-automation" || event.createdBy === "playwright") return true;
  return AUTOMATION_PREFIXES.some((prefix) => id.startsWith(prefix) || name.startsWith(prefix.replace(/-$/, " ")));
}

export interface TestRowContext {
  /** Every event id the classifier considers a test event. */
  testEventIds: Set<string>;
}

/** A contact is a test row when its address is a test address, or every event it appears at is a test event. */
export function contactIsTestRow(contact: Pick<ContactRecord, "email" | "eventsAttended">, context: TestRowContext) {
  if (isTestEmail(contact.email)) return true;
  const events = contact.eventsAttended || [];
  return events.length > 0 && events.every((eventId) => context.testEventIds.has(eventId));
}

/** The same rule for a hash-only person (no raw email: the masked address still carries the domain). */
export function hashOnlyIsTestRow(person: { emailMasked?: string; events: { id: string }[] }, context: TestRowContext) {
  if (isTestMaskedEmail(person.emailMasked)) return true;
  return person.events.length > 0 && person.events.every((event) => context.testEventIds.has(event.id));
}

export function profileIsTestRow(profile: Pick<AttendeeProfile, "email" | "emailMasked" | "eventId">, context: TestRowContext) {
  return isTestEmail(profile.email) || isTestMaskedEmail(profile.emailMasked) || context.testEventIds.has(profile.eventId);
}
