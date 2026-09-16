import { findEventIndexRecord, getAttendeeConfig, getEventConfig } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import type { EventStatus } from "@/types/core";
import type { V4JoinResolution, V4PublicEventState } from "@/types/v4";

type ConfigStatus = EventStatus | "ready_for_review" | "approved";

export function mapEventStatusToPublicState(status: ConfigStatus): V4PublicEventState {
  if (status === "draft" || status === "ready_for_review" || status === "approved") return "draft";
  if (status === "registration_open") return "open";
  if (status === "pre_event" || status === "published") return "upcoming";
  if (status === "live") return "live";
  if (status === "ended" || status === "replay_available") return "ended";
  return "archived";
}

/**
 * Synchronous resolution against whatever is already hydrated (seed JSON plus
 * any runtime event a caller has ensured). Prefer `resolveEventJoinCode`, which
 * hydrates the runtime store first.
 */
export function resolveHydratedEventJoinCode(rawCode: string | undefined): V4JoinResolution {
  const code = rawCode?.trim().toLowerCase();
  if (!code) return { ok: false, reason: "missing_code", message: "Enter the event code from your invitation." };

  const indexRecord = findEventIndexRecord(code);
  if (!indexRecord) return { ok: false, reason: "invalid_code", message: "We could not find an event for that code. Codes look like wpl-xxxxxx — the prefix and hyphen are optional, but every character of the six after it counts. Check it against the invitation and try again." };

  const event = getEventConfig(indexRecord.slug);
  const attendee = getAttendeeConfig(indexRecord.slug);
  if (!event) return { ok: false, reason: "invalid_code", message: "This event is not configured for public access yet." };

  const publicState = mapEventStatusToPublicState((indexRecord.status || event.state) as ConfigStatus);
  if (publicState === "draft") {
    return { ok: false, eventId: event.id, eventSlug: event.slug, eventName: event.name, publicState, reason: "not_public", message: "This event is not publicly open yet." };
  }
  if (publicState === "archived") {
    return { ok: false, eventId: event.id, eventSlug: event.slug, eventName: event.name, publicState, reason: "archived", message: "This event is archived and no longer publicly available." };
  }

  const destination = publicState === "live"
    ? (attendee?.defaultDestination || `/venue/${event.id}/lobby`)
    : publicState === "ended"
      ? `/venue/${event.id}/replay`
      : `/events/${event.slug}`;

  return {
    ok: true,
    eventId: event.id,
    eventSlug: event.slug,
    eventName: event.name,
    publicState,
    destination,
    message: publicState === "ended" ? "Event ended. Replay access is available." : "Event found.",
  };
}

/** Runtime store first (Supabase in production, file store locally), compiled seed JSON second. */
export async function resolveEventJoinCode(rawCode: string | undefined): Promise<V4JoinResolution> {
  const code = rawCode?.trim().toLowerCase();
  // A typed code may be mangled (no prefix, capitals, a space); the record found tells us the real
  // code, and the hydrated lookup must use THAT, not what was typed.
  const runtime = code ? await ensureRuntimeEvent(code) : undefined;
  return resolveHydratedEventJoinCode(runtime?.joinCode ?? code);
}
