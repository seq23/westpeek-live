import type { SpecialGuestRole } from "@/types/specialGuest";

/**
 * A PREVIEW IDENTITY is a `?viewAs=` value that is not a real person.
 *
 * Two kinds, one rule:
 *   `preview-attendee` … `preview-client`  a synthetic PERSONA — "what will a speaker see when
 *                                          they arrive", answerable on a fresh event where no
 *                                          human has entered a role code yet;
 *   `mirror-<attendeeId>`                  a real attendee's own state, rendered read-only for a
 *                                          producer answering "I can't see it".
 *
 * Both render the event's REAL configuration and content, and both are refused at every write
 * path. The refusal lives here — pure, dependency-free — so the services, the pages, the tests
 * and the validator share one rule instead of each remembering it.
 */
export const PREVIEW_PERSONA_PREFIX = "preview-";
export const PREVIEW_MIRROR_PREFIX = "mirror-";

export type PreviewPersonaId = "preview-attendee" | "preview-vip" | "preview-speaker" | "preview-sponsor" | "preview-client";

export interface PreviewPersona {
  id: PreviewPersonaId;
  /** The room role the page renders for. "attendee" is not a SpecialGuestRole; the other four are. */
  role: "attendee" | SpecialGuestRole;
  /** The "Enter the room as…" entry. */
  menuLabel: string;
  /** The banner sentence: "you are seeing this as <this> would". */
  bannerRole: string;
  /** The name the page shows where it would show a person's name. Never mistakable for a real guest. */
  name: string;
  company: string;
  title: string;
  /** Whether the lobby should render the VIP panel for this persona. */
  vip: boolean;
  /** Where this persona enters the room. */
  path: (eventId: string, clientSlug?: string) => string;
}

/** The order the menu renders them in: the room first, then the guest surfaces. */
export const PREVIEW_PERSONAS: readonly PreviewPersona[] = [
  { id: "preview-attendee", role: "attendee", menuLabel: "An attendee", bannerRole: "an attendee", name: "Preview attendee", company: "Preview", title: "Attendee", vip: false, path: (eventId) => `/venue/${eventId}/lobby` },
  { id: "preview-vip", role: "vip", menuLabel: "A VIP", bannerRole: "a VIP", name: "Preview VIP", company: "Preview", title: "VIP", vip: true, path: (eventId) => `/venue/${eventId}/lobby` },
  { id: "preview-speaker", role: "speaker", menuLabel: "A speaker", bannerRole: "a speaker", name: "Preview speaker", company: "Preview", title: "Speaker", vip: false, path: (eventId) => `/speaker/events/${eventId}/green-room` },
  { id: "preview-sponsor", role: "sponsor", menuLabel: "A sponsor", bannerRole: "a sponsor", name: "Preview sponsor", company: "Preview", title: "Sponsor", vip: false, path: (eventId) => `/sponsor/events/${eventId}/booth` },
  { id: "preview-client", role: "client", menuLabel: "The client", bannerRole: "the client", name: "Preview client", company: "Preview", title: "Client", vip: false, path: (eventId, clientSlug) => `/client/${clientSlug || "west-peek"}/events/${eventId}` },
] as const;

export function previewPersona(id: string | undefined): PreviewPersona | undefined {
  return PREVIEW_PERSONAS.find((persona) => persona.id === id);
}

export function isPreviewPersonaId(id: string | undefined): boolean {
  return Boolean(id && id.startsWith(PREVIEW_PERSONA_PREFIX));
}

export function isPreviewMirrorId(id: string | undefined): boolean {
  return Boolean(id && id.startsWith(PREVIEW_MIRROR_PREFIX) && id.length > PREVIEW_MIRROR_PREFIX.length);
}

/** `mirror-attendee-7` → `attendee-7`; anything else → undefined. */
export function mirroredAttendeeId(id: string | undefined): string | undefined {
  return isPreviewMirrorId(id) ? (id as string).slice(PREVIEW_MIRROR_PREFIX.length) : undefined;
}

export function previewMirrorId(attendeeId: string) {
  return `${PREVIEW_MIRROR_PREFIX}${attendeeId}`;
}

/**
 * The single predicate every write path asks. An id is a preview identity whether it arrived as a
 * `?viewAs=` value, a form field, or a hand-made request — the shape of the id IS the rule, so
 * there is nothing to forget to pass down.
 */
export function isPreviewIdentity(id: string | undefined | null): boolean {
  const value = String(id || "");
  return isPreviewPersonaId(value) || isPreviewMirrorId(value);
}

export const PREVIEW_WRITE_REFUSAL = "This is a preview. Nothing you do here is saved, and nobody else can see it. Leave preview to act as yourself.";

export class PreviewWriteRefused extends Error {
  readonly previewId: string;
  readonly attempted: string;
  constructor(previewId: string, attempted: string) {
    super(`${PREVIEW_WRITE_REFUSAL} (refused: ${attempted})`);
    this.name = "PreviewWriteRefused";
    this.previewId = previewId;
    this.attempted = attempted;
  }
}

/**
 * Called at the TOP of every service that writes something another human could see. Throwing
 * rather than returning a flag is deliberate: a caller that forgets to check the flag would write
 * anyway, and a preview that leaves a trace is the one failure this whole feature must not have.
 */
export function refusePreviewWrite(id: string | undefined | null, attempted: string): void {
  if (isPreviewIdentity(id)) throw new PreviewWriteRefused(String(id), attempted);
}

/**
 * Belt and braces for the counts. A persona is never persisted, so it cannot appear in a roster,
 * the People directory, the attendee count, networking, or an export — but "cannot happen" is not
 * a proof, and a future write path that slipped past `refusePreviewWrite` would show a preview to
 * real attendees. Every list that people see is filtered through this, and the filter is tested
 * against rows that were planted on purpose.
 */
export function excludePreviewIdentities<T>(rows: readonly T[], idOf: (row: T) => string | undefined): T[] {
  return rows.filter((row) => !isPreviewIdentity(idOf(row)));
}
