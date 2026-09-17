import eventsIndex from "@/data/events/events.json";
import accessIndex from "@/data/access/event-access-config.json";
import demoEvent from "@/data/events/demo/event.json";
import demoAttendee from "@/data/events/demo/attendee.json";
import demoBranding from "@/data/events/demo/branding.json";
import demoAgenda from "@/data/events/demo/agenda.json";
import demoSpeakers from "@/data/events/demo/speakers.json";
import demoSponsors from "@/data/events/demo/sponsors.json";
import demoRunOfShow from "@/data/events/demo/run-of-show.json";
import demoVideo from "@/data/events/demo/video.json";
import demoCommunications from "@/data/events/demo/communications.json";
import webinarEvent from "@/data/events/leadership-reset-webinar/event.json";
import webinarAttendee from "@/data/events/leadership-reset-webinar/attendee.json";
import webinarBranding from "@/data/events/leadership-reset-webinar/branding.json";
import webinarAgenda from "@/data/events/leadership-reset-webinar/agenda.json";
import webinarSpeakers from "@/data/events/leadership-reset-webinar/speakers.json";
import webinarSponsors from "@/data/events/leadership-reset-webinar/sponsors.json";
import webinarRunOfShow from "@/data/events/leadership-reset-webinar/run-of-show.json";
import webinarVideo from "@/data/events/leadership-reset-webinar/video.json";
import webinarCommunications from "@/data/events/leadership-reset-webinar/communications.json";
import demoDayEvent from "@/data/events/seed-demo-day/event.json";
import demoDayAttendee from "@/data/events/seed-demo-day/attendee.json";
import demoDayBranding from "@/data/events/seed-demo-day/branding.json";
import demoDayAgenda from "@/data/events/seed-demo-day/agenda.json";
import demoDaySpeakers from "@/data/events/seed-demo-day/speakers.json";
import demoDaySponsors from "@/data/events/seed-demo-day/sponsors.json";
import demoDayRunOfShow from "@/data/events/seed-demo-day/run-of-show.json";
import demoDayVideo from "@/data/events/seed-demo-day/video.json";
import demoDayCommunications from "@/data/events/seed-demo-day/communications.json";
import expoEvent from "@/data/events/provider-innovation-expo/event.json";
import expoAttendee from "@/data/events/provider-innovation-expo/attendee.json";
import expoBranding from "@/data/events/provider-innovation-expo/branding.json";
import expoAgenda from "@/data/events/provider-innovation-expo/agenda.json";
import expoSpeakers from "@/data/events/provider-innovation-expo/speakers.json";
import expoSponsors from "@/data/events/provider-innovation-expo/sponsors.json";
import expoRunOfShow from "@/data/events/provider-innovation-expo/run-of-show.json";
import expoVideo from "@/data/events/provider-innovation-expo/video.json";
import expoCommunications from "@/data/events/provider-innovation-expo/communications.json";
import workshopEvent from "@/data/events/premium-workshop-intensive/event.json";
import workshopAttendee from "@/data/events/premium-workshop-intensive/attendee.json";
import workshopBranding from "@/data/events/premium-workshop-intensive/branding.json";
import workshopAgenda from "@/data/events/premium-workshop-intensive/agenda.json";
import workshopSpeakers from "@/data/events/premium-workshop-intensive/speakers.json";
import workshopSponsors from "@/data/events/premium-workshop-intensive/sponsors.json";
import workshopRunOfShow from "@/data/events/premium-workshop-intensive/run-of-show.json";
import workshopVideo from "@/data/events/premium-workshop-intensive/video.json";
import workshopCommunications from "@/data/events/premium-workshop-intensive/communications.json";
import type { V4SpecialGuestRole } from "@/types/v4";
import { peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import { demoShowStartMs } from "@/lib/mock/demoSchedule";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

export interface EventIndexRecord {
  slug: string;
  eventId: string;
  publicCode: string;
  status: string;
  configPath: string;
}

export interface EventConfigRecord {
  id: string;
  slug: string;
  name: string;
  client: string;
  clientSlug?: string;
  timezone: string;
  state: string;
  publishLifecycle: string;
  publicCode: string;
  runtimeStateBoundary: string;
  /**
   * A sample event that exists to be SHOWN, with no real stream, no real client and no real
   * attendees behind it. Declared by the event's own config file, never inferred from a slug.
   *
   * The health probes read this to tell "no feed because this is a sample event" apart from "no
   * feed and there should be one" — a demonstration event is still probed, still reports every
   * signal, and its reading still says out loud that it is a demonstration. What it does not do is
   * report a production failure for a stream nobody ever intended to send.
   */
  demonstration?: boolean;
}

export interface AttendeeConfigRecord {
  eventId: string;
  joinStates: string[];
  defaultDestination: string;
  supportEnabled: boolean;
}

export interface AccessConfigRoleCode {
  role: V4SpecialGuestRole;
  envKey: string;
  destinationTemplate: string;
}

export interface EventAccessConfigRecord {
  eventId: string;
  crewPasswordEnvKey: string;
  specialGuestCodes: AccessConfigRoleCode[];
}


export interface EventConfigPackage {
  event: EventConfigRecord;
  attendee: AttendeeConfigRecord;
  branding: { eventId: string; logo: string; hero: string; theme: string };
  agenda: { eventId: string; sessions: Array<Record<string, string>> };
  speakers: { eventId: string; speakers: Array<Record<string, string>> };
  sponsors: { eventId: string; sponsors: Array<Record<string, string>> };
  runOfShow: { eventId: string; segments: Array<Record<string, string>> };
  video: { eventId: string; providerLadder: string[]; dailyAutomatic: boolean; zoomRequiresCrewConfirmation: boolean; googleMeetManualOnly: boolean; roomLevelOverrides: boolean };
  communications: { eventId: string; templates: string[] };
}

type AccessIndex = { events: Record<string, EventAccessConfigRecord> };

const eventConfigs: Record<string, EventConfigRecord> = {
  demo: demoEvent as EventConfigRecord,
  "leadership-reset-webinar": webinarEvent as EventConfigRecord,
  "seed-demo-day": demoDayEvent as EventConfigRecord,
  "provider-innovation-expo": expoEvent as EventConfigRecord,
  "premium-workshop-intensive": workshopEvent as EventConfigRecord,
};

const attendeeConfigs: Record<string, AttendeeConfigRecord> = {
  demo: demoAttendee as AttendeeConfigRecord,
  "leadership-reset-webinar": webinarAttendee as AttendeeConfigRecord,
  "seed-demo-day": demoDayAttendee as AttendeeConfigRecord,
  "provider-innovation-expo": expoAttendee as AttendeeConfigRecord,
  "premium-workshop-intensive": workshopAttendee as AttendeeConfigRecord,
};


const eventLookupAliases: Record<string, string> = {
  "nova-summit": "demo",
  "nova-founder-summit": "demo",
};

function normalizeEventLookupKey(rawCode: string | undefined) {
  const code = rawCode?.trim().toLowerCase();
  if (!code) return undefined;
  return eventLookupAliases[code] || code;
}

function dynamicEventIndexRecord(code: string | undefined): EventIndexRecord | undefined {
  const event = peekOverlayEvent(code);
  if (!event) return undefined;
  return {
    slug: event.slug,
    eventId: event.id,
    publicCode: event.joinCode,
    status: event.status,
    configPath: `runtime_events#${event.id}`,
  };
}

function dynamicEventConfig(code: string | undefined): EventConfigRecord | undefined {
  const event = peekOverlayEvent(code);
  if (!event) return undefined;
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    client: event.clientName,
    clientSlug: event.clientSlug,
    timezone: event.timezone,
    state: event.status,
    publishLifecycle: event.status === "draft" ? "draft" : "published",
    publicCode: event.joinCode,
    runtimeStateBoundary: "event_scoped_runtime",
  };
}

function dynamicAttendeeConfig(code: string | undefined): AttendeeConfigRecord | undefined {
  const event = dynamicEventConfig(code);
  if (!event) return undefined;
  const joinStates = ["invalid_code", "not_open", "live", "ended", "replay_available"];
  if (peekOverlayEvent(code)?.registrationEnabled) joinStates.push("registration_required");
  return { eventId: event.id, joinStates, defaultDestination: `/venue/${event.id}/lobby`, supportEnabled: true };
}

function formatTime(iso: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function runtimePackageBody(event: RuntimeEventRecord): Omit<EventConfigPackage, "event" | "attendee"> {
  const sessions = event.sessions.length
    ? event.sessions
    : [{ id: `${event.id}-main-stage`, title: "Main stage", room: "Main Stage", startAt: event.startAt, endAt: event.endAt }];
  return {
    branding: { eventId: event.id, logo: event.branding.logo || "west-peek-live", hero: event.branding.hero || event.name, theme: event.branding.theme || "west-peek-live" },
    agenda: { eventId: event.id, sessions: sessions.map((session) => ({ id: session.id, title: session.title, room: session.room, startsAt: formatTime(session.startAt, event.timezone) })) },
    speakers: { eventId: event.id, speakers: [] },
    sponsors: { eventId: event.id, sponsors: [] },
    runOfShow: { eventId: event.id, segments: sessions.map((session) => ({ id: `${session.id}-segment`, title: session.title, startsAt: formatTime(session.startAt, event.timezone), stage: session.room })) },
    video: { eventId: event.id, providerLadder: ["livekit", "cloudflare-stream", "daily", "zoom", "google-meet"], dailyAutomatic: true, zoomRequiresCrewConfirmation: true, googleMeetManualOnly: true, roomLevelOverrides: true },
    communications: { eventId: event.id, templates: ["attendee_registration", "speaker_instructions", "sponsor_instructions", "crew_call_sheet"] },
  };
}

function dynamicPackageBody(event: EventConfigRecord): Omit<EventConfigPackage, "event" | "attendee"> | undefined {
  const runtime = peekOverlayEvent(event.id);
  return runtime ? runtimePackageBody(runtime) : undefined;
}

/**
 * Runtime events store their role codes on the row (minted at creation), so the
 * env-key names below are labels for the access page, not secrets to resolve.
 */
function dynamicAccessConfig(code: string | undefined): EventAccessConfigRecord | undefined {
  const event = dynamicEventConfig(code);
  if (!event) return undefined;
  return {
    eventId: event.id,
    crewPasswordEnvKey: "runtime_events.crew_code",
    specialGuestCodes: [
      { role: "client", envKey: "runtime_events.client_code", destinationTemplate: "/client/{clientSlug}/events/{eventId}" },
      { role: "speaker", envKey: "runtime_events.speaker_code", destinationTemplate: "/speaker/events/{eventId}" },
      { role: "sponsor", envKey: "runtime_events.sponsor_code", destinationTemplate: "/sponsor/events/{eventId}" },
      { role: "vip", envKey: "runtime_events.vip_code", destinationTemplate: "/venue/{eventId}/lobby" },
      { role: "crew_lite", envKey: "runtime_events.crew_code", destinationTemplate: "/crew/events/{eventId}" },
    ],
  };
}

export function getGeneratedEventRoleCode(eventCode: string | undefined, role: V4SpecialGuestRole): string | undefined {
  const event = peekOverlayEvent(eventCode);
  if (!event) return undefined;
  if (role === "crew_lite") return event.accessCodes.crew || undefined;
  return event.accessCodes[role] || undefined;
}

const eventConfigPackages: Record<string, Omit<EventConfigPackage, "event" | "attendee">> = {
  demo: {
    branding: demoBranding,
    speakers: demoSpeakers,
    sponsors: demoSponsors,
    video: demoVideo,
    communications: demoCommunications,
    get agenda() { return { eventId: demoAgenda.eventId, sessions: reanchorDemoRows(demoAgenda.sessions) }; },
    get runOfShow() { return { eventId: demoRunOfShow.eventId, segments: reanchorDemoRows(demoRunOfShow.segments) }; },
  } as Omit<EventConfigPackage, "event" | "attendee">,
  "leadership-reset-webinar": {
    branding: webinarBranding,
    agenda: webinarAgenda,
    speakers: webinarSpeakers,
    sponsors: webinarSponsors,
    runOfShow: webinarRunOfShow,
    video: webinarVideo,
    communications: webinarCommunications,
  } as Omit<EventConfigPackage, "event" | "attendee">,
  "seed-demo-day": {
    branding: demoDayBranding,
    agenda: demoDayAgenda,
    speakers: demoDaySpeakers,
    sponsors: demoDaySponsors,
    runOfShow: demoDayRunOfShow,
    video: demoDayVideo,
    communications: demoDayCommunications,
  } as Omit<EventConfigPackage, "event" | "attendee">,
  "provider-innovation-expo": {
    branding: expoBranding,
    agenda: expoAgenda,
    speakers: expoSpeakers,
    sponsors: expoSponsors,
    runOfShow: expoRunOfShow,
    video: expoVideo,
    communications: expoCommunications,
  } as Omit<EventConfigPackage, "event" | "attendee">,
  "premium-workshop-intensive": {
    branding: workshopBranding,
    agenda: workshopAgenda,
    speakers: workshopSpeakers,
    sponsors: workshopSponsors,
    runOfShow: workshopRunOfShow,
    video: workshopVideo,
    communications: workshopCommunications,
  } as Omit<EventConfigPackage, "event" | "attendee">,
};


/**
 * The demo summit's config carries a canonical show day (12 June 2026, 15:00Z) so that the JSON
 * stays readable and diffable. Everything that renders it — the public event page, the workspace
 * agenda, the client run-of-show view — re-anchors those instants onto the viewer's own day, the
 * same anchor the venue uses, so the demo never shows a landing page for an event that finished
 * months ago while its venue is mid-panel. Only the demo is re-anchored; every other event keeps
 * the instants its producer typed.
 */
const DEMO_CONFIG_SHOW_DAY_MS = Date.parse("2026-06-12T15:00:00.000Z");

function reanchorDemoInstant(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(demoShowStartMs() + (parsed - DEMO_CONFIG_SHOW_DAY_MS)).toISOString();
}

function reanchorDemoRows(rows: Array<Record<string, string>>): Array<Record<string, string>> {
  return rows.map((row) => {
    const next: Record<string, string> = { ...row };
    for (const key of ["startsAt", "endsAt", "startAt", "endAt"]) {
      if (typeof next[key] === "string") next[key] = reanchorDemoInstant(next[key]);
    }
    return next;
  });
}

export function getEventIndex(): EventIndexRecord[] {
  return (eventsIndex as { events: EventIndexRecord[] }).events;
}

export function findEventIndexRecord(rawCode: string | undefined) {
  const code = normalizeEventLookupKey(rawCode);
  if (!code) return undefined;
  return getEventIndex().find((event) => event.slug === code || event.publicCode.toLowerCase() === code || event.eventId.toLowerCase() === code) || dynamicEventIndexRecord(code);
}

export function getEventConfig(slugOrEventId: string | undefined): EventConfigRecord | undefined {
  const code = normalizeEventLookupKey(slugOrEventId);
  if (!code) return undefined;
  const record = getEventIndex().find((item) => item.slug === code || item.eventId === code || item.publicCode.toLowerCase() === code);
  return record ? (eventConfigs[record.slug] || dynamicEventConfig(record.slug)) : (eventConfigs[code] || dynamicEventConfig(code));
}

/**
 * Is this event a demonstration — a sample event shown to people, with nothing real behind it?
 *
 * True ONLY when the event's own config file declares `demonstration: true`. A runtime event
 * (every real event the owner or a client creates) is built by `dynamicEventConfig`, which does
 * not set the flag, so a real event can never answer true here by accident. An unknown id answers
 * false, which is the safe direction: an event we cannot identify is treated as real.
 */
export function isDemonstrationEvent(slugOrEventId: string | undefined): boolean {
  return Boolean(getEventConfig(slugOrEventId)?.demonstration);
}

export function getAttendeeConfig(slugOrEventId: string | undefined): AttendeeConfigRecord | undefined {
  const code = normalizeEventLookupKey(slugOrEventId);
  if (!code) return undefined;
  const record = getEventIndex().find((item) => item.slug === code || item.eventId === code || item.publicCode.toLowerCase() === code);
  return record ? (attendeeConfigs[record.slug] || dynamicAttendeeConfig(record.slug)) : (attendeeConfigs[code] || dynamicAttendeeConfig(code));
}

export function getEventAccessConfig(slug: string): EventAccessConfigRecord | undefined {
  const access = accessIndex as AccessIndex;
  return access.events[slug] || dynamicAccessConfig(slug);
}

export function destinationForRole(role: V4SpecialGuestRole, eventId: string) {
  const record = findEventIndexRecord(eventId);
  const config = getEventConfig(record?.slug || eventId);
  const access = getEventAccessConfig(record?.slug || eventId);
  const roleConfig = access?.specialGuestCodes.find((item) => item.role === role);
  const template = roleConfig?.destinationTemplate;
  if (!template) return `/venue/${eventId}/lobby`;
  return template
    .replaceAll("{eventId}", eventId)
    .replaceAll("{eventSlug}", record?.slug || eventId)
    .replaceAll("{clientSlug}", config?.clientSlug || "client");
}

export function getEventConfigPackage(slugOrEventId: string | undefined): EventConfigPackage {
  const event = getEventConfig(slugOrEventId);
  if (!event) throw new Error(`Event config package missing event record for ${slugOrEventId || "unknown"}.`);
  const attendee = getAttendeeConfig(event.slug);
  if (!attendee) throw new Error(`Event config package missing attendee config for ${event.slug}.`);
  const packageBody = eventConfigPackages[event.slug] || dynamicPackageBody(event);
  if (!packageBody) throw new Error(`Event config package missing files for ${event.slug}.`);
  return { event, attendee, ...packageBody };
}
