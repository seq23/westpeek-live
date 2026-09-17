import type { RegistrationQuestion } from "@/types/attendeeRegistration";

/**
 * The house defaults: what a new event, a sent email and the capacity readout start from.
 *
 * These live on their OWN row rather than widening the agency settings row, for two reasons. The
 * agency settings row is identity — the name on the door, the two brand colours, who is on the
 * team — and it is read on the dashboard on every page load. These are operational defaults read
 * by the create path, the email provider and the capacity module, and they will keep growing. A
 * separate row keeps the hot identity read narrow and lets each module read only what it governs.
 *
 * Nothing secret goes here. Access codes and master passwords stay in the owner-only audited vault
 * in the Owner Console; this row is reachable by any operator who can open Settings.
 */
export const HOUSE_DEFAULTS_ID = "west-peek";

export interface HouseDefaultsRecord {
  id: string;
  /** The envelope address emails leave from. Resend will only accept a verified domain here. */
  fromEmail: string;
  /** Where a reply lands. Does not need to be on the verified domain. */
  replyToEmail: string;
  /** A logo in the private asset bucket; empty means the built-in wordmark. */
  logoStoragePath: string;
  /** The uploaded logo's own file name, so the Settings page can say which file is in place. */
  logoFileName: string;
  /** The zone /app/events/new opens on. */
  defaultTimezone: string;
  /** Minutes per speed-networking match, inherited by each new event. */
  defaultNetworkingMatchMinutes: number;
  /** How long an attendee stays registered, in days. The per-event override still wins. */
  defaultAttendeeSessionDays: number;
  /** The "Tell us more" set a new event starts from. */
  defaultRegistrationQuestions: RegistrationQuestion[];
  /** "" means "whatever LIVEKIT_TIER says", so an unset row changes nothing. */
  livekitTier: "" | "build" | "ship" | "scale";
  /**
   * When the four starter templates were written to the store. Set once and never cleared: it is
   * what makes them ordinary rows the owner can delete rather than fixtures that grow back.
   */
  starterTemplatesInstalledAt: string;
  updatedBy: string;
  updatedByLabel: string;
  updatedAt: string;
}

/** A from address Resend can actually send from has to be a real address on a domain you verified. */
export function isSendableAddress(value: string) {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value.trim());
}

export function houseEmailDomain(value: string) {
  return value.trim().split("@")[1]?.toLowerCase() || "";
}
