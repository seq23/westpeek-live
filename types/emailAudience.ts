import type { EmailWorkflowType } from "@/types/emailWorkflows";

/**
 * Emailing a GROUP, as opposed to the seven transactional messages that go to one named person.
 *
 * The distinction is the whole point of this file and it is load-bearing everywhere below. A
 * transactional message is somebody's own green room link: it is addressed to them, they are
 * expecting it, and it is never suppressed. A group message is an announcement: it is bulk email,
 * it carries an unsubscribe link, and anybody on West Peek's unsubscribe list is left out of it.
 */
export type EmailAudienceKind =
  | "attendees"
  | "vips"
  | "speakers"
  | "sponsors"
  | "crew"
  | "client"
  | "one_person";

/** One person in a resolved audience. `personKey` is the lowercased address: the identity that dedupes. */
export interface AudienceMember {
  personKey: string;
  email: string;
  name?: string;
  /** Where this address came from, shown when the sender expands the list ("attendee", "VIP grant"). */
  source: string;
}

/**
 * What an audience actually resolves to, before anybody presses Send.
 *
 * `ok: false` is not an error page — it is the honest answer for "this group is empty" or "these
 * people have no address on file", and the composer refuses the send rather than reporting a
 * successful send to nobody.
 */
export interface ResolvedAudience {
  kind: EmailAudienceKind;
  eventId?: string;
  /** "All registered attendees", "Speakers" — what the confirm sentence names. */
  label: string;
  /** Everybody who will be emailed: deduped, and with the unsubscribed already removed. */
  members: AudienceMember[];
  /** Resolved, then removed because the person is on West Peek's unsubscribe list. */
  suppressed: AudienceMember[];
  /** Resolved, then removed because there is no address on file for them. */
  withoutEmail: number;
  ok: boolean;
  /** Why the audience cannot be sent to, in the sentence the composer shows. */
  reason?: string;
}

export interface AudienceOption {
  kind: EmailAudienceKind;
  label: string;
  /** One line on where these people come from, so nobody sends to a group they cannot see. */
  whereFrom: string;
  /** True when the audience is one named person and the composer needs an address typed in. */
  needsAddress?: boolean;
  /** The workflow a plain "write your own" message is logged as for this audience. */
  customWorkflow: EmailWorkflowType;
}

/**
 * The audiences the composer offers, in the order the owner asked for them. `customWorkflow` is
 * how a written-from-scratch message is classified in the log: the instructions_* workflows already
 * exist in the template labels for exactly this, so a custom send is never logged as something it
 * is not.
 */
export const AUDIENCE_OPTIONS: readonly AudienceOption[] = [
  { kind: "attendees", label: "All registered attendees", whereFrom: "Everyone with an active registration for this event.", customWorkflow: "instructions_attendee" },
  { kind: "vips", label: "VIPs", whereFrom: "Current VIP grants for this event — rotating the VIP code drops the people admitted under the old one.", customWorkflow: "instructions_attendee" },
  { kind: "speakers", label: "Speakers", whereFrom: "Speakers on this event who have given an address.", customWorkflow: "instructions_speaker" },
  { kind: "sponsors", label: "Sponsors", whereFrom: "Sponsors on this event who have given an address.", customWorkflow: "instructions_sponsor" },
  { kind: "crew", label: "Crew", whereFrom: "Contractors booked on this event.", customWorkflow: "instructions_crew" },
  { kind: "client", label: "The client", whereFrom: "The client contact on this event.", customWorkflow: "instructions_client" },
  { kind: "one_person", label: "One person", whereFrom: "An address you type. Addressed to them, so it is never suppressed by the unsubscribe list.", needsAddress: true, customWorkflow: "instructions_attendee" },
];

export function audienceOption(kind: string): AudienceOption | undefined {
  return AUDIENCE_OPTIONS.find((option) => option.kind === kind);
}

export function isAudienceKind(value: string): value is EmailAudienceKind {
  return AUDIENCE_OPTIONS.some((option) => option.kind === value);
}

/** One group send: the line on the Email page that expands into its per-recipient rows. */
export interface EmailGroupSend {
  id: string;
  eventId?: string;
  audience: EmailAudienceKind;
  audienceLabel: string;
  workflowType: EmailWorkflowType;
  subject: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  sentBy?: string;
  createdAt: string;
}

/**
 * One person on West Peek's unsubscribe list. Keyed by address, not by event: this is the list for
 * the whole business, so unsubscribing from one event's announcement suppresses every future group
 * send for every event. Resubscribing is a later timestamp, never a delete.
 */
export interface EmailUnsubscribeRecord {
  email: string;
  emailHash: string;
  unsubscribedAt: string;
  unsubscribedSource: "one_click" | "crew";
  lastEventId?: string;
  resubscribedAt?: string;
  resubscribedBy?: string;
}

/** Suppressed only while the unsubscribe is the most recent thing that happened to this address. */
export function unsubscribeIsActive(record: EmailUnsubscribeRecord) {
  if (!record.resubscribedAt) return true;
  return record.resubscribedAt <= record.unsubscribedAt;
}
