import { destinationForRole, findEventIndexRecord, getEventAccessConfig, getEventConfig, getGeneratedEventRoleCode } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent, peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import { getCrewAccessPassword } from "@/lib/env";
import type { V4AccessResolution, V4CrewRole, V4SpecialGuestRole } from "@/types/v4";
import { codesMatch, isBuiltFromJoinCode, liveRoleCode, ROLE_CODE_FIELDS, type AccessCodeField } from "@/lib/access/accessCodes";
import { matchesHostCode } from "@/services/events/hostLinkService";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";
import { findSupersededCodeForField } from "@/services/events/supersededCodeService";
import { supersededPrivilegedMessage } from "@/types/supersededCode";

/**
 * A privileged code is a credential, and the reason to rotate one is to END somebody's access — so
 * an old crew, speaker, sponsor, client or VIP code must still be refused. What changes (17 Sep
 * 2026) is what the refusal SAYS. "That access code is not valid for this event" is the same
 * sentence a guess gets, so the holder of a code we rotated yesterday cannot tell whether they
 * mistyped, were never invited, or lost access on purpose, and their only move is to try again.
 *
 * Now the gate looks the value up in the event's code history and, when it finds it, names the
 * credential and the day it was replaced and points at the one person who can hand out the new one.
 * It still returns ok:false — nothing downstream mints a cookie — so rotation revokes exactly as
 * hard as it did before. The seam between "no" and "no, and here is why" is the only thing moved.
 *
 * crew_lite shares the crew code, so it is looked up against the crew field.
 */
const ROLE_FIELD: Record<V4SpecialGuestRole, Exclude<AccessCodeField, "join">> = { client: "client", speaker: "speaker", sponsor: "sponsor", vip: "vip", crew_lite: "crew" };

async function supersededRoleRefusal(eventId: string, typedCode: string, roles: V4SpecialGuestRole[]): Promise<V4AccessResolution | undefined> {
  for (const role of roles) {
    const field = ROLE_FIELD[role];
    const hit = await findSupersededCodeForField(typedCode, field, eventId);
    if (!hit) continue;
    return { ok: false, accessKind: "special_guest", eventId, reason: "superseded_code", supersededAt: hit.record.replacedAt, supersededField: field, message: supersededPrivilegedMessage(field, hit.record.replacedAt) };
  }
  return undefined;
}

/**
 * A role code built from the event code (WPL-CREW-STEM) after LEGACY_ROLE_CODE_CUTOFF: refused like
 * any other wrong code, but told the production team changed it so the holder asks for a new link.
 */
function retiredRoleCodeRefusal(event: Pick<RuntimeEventRecord, "joinCode" | "accessCodes"> | undefined, typed: string, accessKind: "crew" | "special_guest", eventId: string | undefined): V4AccessResolution | undefined {
  if (!event) return undefined;
  const retired = ROLE_CODE_FIELDS.some((field) => codesMatch(event.accessCodes?.[field], typed) && isBuiltFromJoinCode(typed, event.joinCode, field) && !liveRoleCode(event, field));
  if (!retired) return undefined;
  return { ok: false, accessKind, eventId, reason: "rotated", message: "That code was changed by the production team. Ask them for the new link." };
}

function readEnvCode(envKey: string) {
  return process.env[envKey]?.trim();
}

export async function resolveSpecialGuestAccess(eventCode: string | undefined, roleCode: string | undefined): Promise<V4AccessResolution> {
  const normalizedRoleCode = roleCode?.trim();
  if (!eventCode?.trim() || !normalizedRoleCode) {
    return { ok: false, accessKind: "special_guest", reason: "missing_code", message: "Enter both the event code and your role access code." };
  }

  // The join code typed in any case, with a space for the dash: the runtime resolver forgives it; look the index up by the resolved id.
  const hydrated = await ensureRuntimeEvent(eventCode);
  const eventRecord = findEventIndexRecord(hydrated?.id || eventCode);
  if (!eventRecord) return { ok: false, accessKind: "special_guest", reason: "invalid_event", message: "We could not match that event code." };

  const accessConfig = getEventAccessConfig(eventRecord.slug);
  if (!accessConfig || accessConfig.eventId !== eventRecord.eventId) {
    return { ok: false, accessKind: "special_guest", eventId: eventRecord.eventId, reason: "invalid_event", message: "This event is not configured for special guest access." };
  }

  // Runtime events carry their codes on the row (minted at creation); seed events keep the legacy env secrets.
  const runtimeEvent = peekOverlayEvent(eventRecord.slug);
  const matchingRole = accessConfig.specialGuestCodes.find((item) => {
    const expected = runtimeEvent ? getGeneratedEventRoleCode(eventRecord.slug, item.role) : readEnvCode(item.envKey);
    // Case-insensitive, spaces and dashes ignored: a code typed from a phone still opens the door.
    return Boolean(expected && codesMatch(expected, normalizedRoleCode));
  });

  if (!matchingRole) {
    // Only on a miss, and it never grants: it turns the generic "no" into one the holder can act on.
    const retired = retiredRoleCodeRefusal(runtimeEvent, normalizedRoleCode, "special_guest", eventRecord.eventId);
    if (retired) return retired;
    const superseded = await supersededRoleRefusal(eventRecord.eventId, normalizedRoleCode, accessConfig.specialGuestCodes.map((item) => item.role));
    if (superseded) return superseded;
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
    // Executive producer is one event's host: with no event named there is no host code to check.
    if (crewRole === "executive_producer") return { ok: false, accessKind: "crew", reason: "host_link_required", message: "The executive producer comes in with a host link from the owner or the operator." };
    if (password !== undefined && (!globalPassword || password !== globalPassword)) {
      return { ok: false, accessKind: "crew", reason: "invalid_password", message: "That crew password did not match." };
    }
    return { ok: true, accessKind: "crew", role: crewRole, destination: "/crew/events/demo", message: "Crew access granted." };
  }
  const hydrated = await ensureRuntimeEvent(eventCode);
  const eventRecord = findEventIndexRecord(hydrated?.id || eventCode);
  if (crewRole === "executive_producer") {
    // The host: only the host code opens it, never the crew code or the global crew password, so
    // a crew link cannot be turned into the host by picking a different line in the role list.
    const runtimeEvent = eventRecord ? peekOverlayEvent(eventRecord.slug) : undefined;
    if (!eventRecord || !runtimeEvent) return { ok: false, accessKind: "crew", eventId: eventRecord?.eventId, reason: "host_link_required", message: "The executive producer comes in with a host link from the owner or the operator." };
    if (!(await matchesHostCode(eventRecord.eventId, password).catch(() => false))) {
      return { ok: false, accessKind: "crew", eventId: eventRecord.eventId, reason: "host_link_required", message: "The executive producer comes in with a host link from the owner or the operator." };
    }
    return { ok: true, accessKind: "crew", eventId: eventRecord.eventId, role: crewRole, destination: `/crew/events/${eventRecord.eventId}`, message: "Host access granted." };
  }
  if (password !== undefined) {
    const runtimeEvent = eventRecord ? peekOverlayEvent(eventRecord.slug) : undefined;
    const eventCrewCode = runtimeEvent ? liveRoleCode(runtimeEvent, "crew") : undefined;
    const matchesGlobal = Boolean(globalPassword && password === globalPassword);
    const matchesEvent = Boolean(eventCrewCode && codesMatch(eventCrewCode, password));
    if (!matchesGlobal && !matchesEvent) {
      const retired = retiredRoleCodeRefusal(runtimeEvent, password, "crew", eventRecord?.eventId);
      if (retired) return retired;
      // A rotated crew code still fails — that is the point of rotating it — but it says which
      // credential went and when, so the crew member asks the producer instead of retyping.
      const hit = eventRecord ? await findSupersededCodeForField(password, "crew", eventRecord.eventId) : undefined;
      if (hit) return { ok: false, accessKind: "crew", eventId: eventRecord?.eventId, reason: "superseded_code", supersededAt: hit.record.replacedAt, supersededField: "crew", message: supersededPrivilegedMessage("crew", hit.record.replacedAt) };
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
