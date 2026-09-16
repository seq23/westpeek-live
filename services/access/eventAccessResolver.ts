import { destinationForRole, findEventIndexRecord, getEventAccessConfig, getEventConfig, getGeneratedEventRoleCode } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent, peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import { getCrewAccessPassword } from "@/lib/env";
import type { V4AccessResolution, V4CrewRole } from "@/types/v4";

function readEnvCode(envKey: string) {
  return process.env[envKey]?.trim();
}

export async function resolveSpecialGuestAccess(eventCode: string | undefined, roleCode: string | undefined): Promise<V4AccessResolution> {
  const normalizedRoleCode = roleCode?.trim();
  if (!eventCode?.trim() || !normalizedRoleCode) {
    return { ok: false, accessKind: "special_guest", reason: "missing_code", message: "Enter both the event code and your role access code." };
  }

  await ensureRuntimeEvent(eventCode);
  const eventRecord = findEventIndexRecord(eventCode);
  if (!eventRecord) return { ok: false, accessKind: "special_guest", reason: "invalid_event", message: "We could not match that event code." };

  const accessConfig = getEventAccessConfig(eventRecord.slug);
  if (!accessConfig || accessConfig.eventId !== eventRecord.eventId) {
    return { ok: false, accessKind: "special_guest", eventId: eventRecord.eventId, reason: "invalid_event", message: "This event is not configured for special guest access." };
  }

  // Runtime events carry their codes on the row (minted at creation); seed events keep the legacy env secrets.
  const runtimeEvent = peekOverlayEvent(eventRecord.slug);
  const matchingRole = accessConfig.specialGuestCodes.find((item) => {
    const expected = runtimeEvent ? getGeneratedEventRoleCode(eventRecord.slug, item.role) : readEnvCode(item.envKey);
    return Boolean(expected && expected === normalizedRoleCode);
  });

  if (!matchingRole) {
    return { ok: false, accessKind: "special_guest", eventId: eventRecord.eventId, reason: "invalid_role_code", message: "That access code is not valid for this event." };
  }

  const eventConfig = getEventConfig(eventRecord.slug);
  return {
    ok: true,
    accessKind: "special_guest",
    eventId: eventRecord.eventId,
    clientSlug: eventConfig?.clientSlug,
    role: matchingRole.role,
    destination: destinationForRole(matchingRole.role, eventRecord.eventId),
    message: "Access granted.",
  };
}

/**
 * Crew entry accepts the global CREW_ACCESS_PASSWORD (any event) or, for a
 * runtime-created event, that event's own crew code minted at creation.
 */
export async function resolveCrewAccess(eventCode: string | undefined, crewRole: V4CrewRole = "crew", password?: string): Promise<V4AccessResolution> {
  const globalPassword = getCrewAccessPassword()?.trim();
  if (!eventCode?.trim()) {
    if (password !== undefined && (!globalPassword || password !== globalPassword)) {
      return { ok: false, accessKind: "crew", reason: "invalid_password", message: "That crew password did not match." };
    }
    return { ok: true, accessKind: "crew", role: crewRole, destination: "/crew/events/demo", message: "Crew access granted." };
  }
  await ensureRuntimeEvent(eventCode);
  const eventRecord = findEventIndexRecord(eventCode);
  if (password !== undefined) {
    const runtimeEvent = eventRecord ? peekOverlayEvent(eventRecord.slug) : undefined;
    const eventCrewCode = runtimeEvent?.accessCodes.crew;
    const matchesGlobal = Boolean(globalPassword && password === globalPassword);
    const matchesEvent = Boolean(eventCrewCode && password === eventCrewCode);
    if (!matchesGlobal && !matchesEvent) {
      return { ok: false, accessKind: "crew", eventId: eventRecord?.eventId, reason: "invalid_password", message: "That crew password or event crew code did not match." };
    }
  }
  if (!eventRecord) {
    return { ok: false, accessKind: "crew", reason: "invalid_event", message: "That event code is not valid for crew routing." };
  }
  return {
    ok: true,
    accessKind: "crew",
    eventId: eventRecord.eventId,
    role: crewRole,
    destination: `/crew/events/${eventRecord.eventId}`,
    message: "Crew access granted.",
  };
}
