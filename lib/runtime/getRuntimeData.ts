import { mockData as runtimeSeedData, mockUsers as runtimeSeedUsers } from "@/lib/mock/mockData";
import { listOverlayEvents, peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

type SeedEvent = (typeof runtimeSeedData.events)[number];
type SeedClient = (typeof runtimeSeedData.clients)[number];
type SeedSession = (typeof runtimeSeedData.sessions)[number];
type SeedRunOfShow = (typeof runtimeSeedData.runOfShowSegments)[number];

const RUNTIME_AGENCY_ID = runtimeSeedData.agencies[0]?.id || "agency-wpp";

function runtimeClientId(event: RuntimeEventRecord) {
  return event.clientId ? `runtime-client-${event.clientId}` : "runtime-client-west-peek";
}

/** A runtime-created event shaped like the seed read model so deep sync consumers keep working. */
export function runtimeEventAsSeedEvent(event: RuntimeEventRecord): SeedEvent {
  return {
    id: event.id,
    agencyId: RUNTIME_AGENCY_ID,
    clientId: runtimeClientId(event),
    name: event.name,
    slug: event.slug,
    eventType: (event.eventType || "webinar") as SeedEvent["eventType"],
    status: event.status,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    description: event.description || `${event.name} — created in the West Peek Live workspace.`,
    internalGoal: event.format === "room" ? "Run an on-demand West Peek room." : "Run a planned client event from the workspace.",
    clientFacingGoal: `Operate ${event.name} with a join code, venue, roles, and video readiness.`,
    primaryProducerUserId: "owner",
    projectManagerUserId: "owner",
    registrationEnabled: event.registrationEnabled,
    venueEnabled: true,
    replayEnabled: true,
    reportingEnabled: true,
  };
}

function runtimeEventClient(event: RuntimeEventRecord): SeedClient {
  return {
    id: runtimeClientId(event),
    agencyId: RUNTIME_AGENCY_ID,
    name: event.clientName,
    slug: event.clientSlug,
    industry: "",
    status: "active",
    primaryContactName: "",
    primaryContactEmail: "",
  };
}

function dynamicDraftEvent(eventId: string): SeedEvent | undefined {
  const event = peekOverlayEvent(eventId);
  return event ? runtimeEventAsSeedEvent(event) : undefined;
}

function dynamicDraftSessions(eventId: string): SeedSession[] | undefined {
  const event = peekOverlayEvent(eventId);
  if (!event) return undefined;
  const sessions = event.sessions.length ? event.sessions : [{ id: `${event.id}-main-stage`, title: "Main stage", room: "Main Stage", startAt: event.startAt, endAt: event.endAt }];
  return sessions.map((session) => ({
    ...runtimeSeedData.sessions[0],
    id: session.id,
    eventId: event.id,
    name: session.title,
    description: `${session.room} · ${event.name}`,
    startAt: session.startAt,
    endAt: session.endAt,
  })) as SeedSession[];
}

function dynamicDraftRunOfShow(eventId: string): SeedRunOfShow[] | undefined {
  const event = peekOverlayEvent(eventId);
  if (!event) return undefined;
  const sessions = dynamicDraftSessions(eventId) || [];
  return sessions.map((session, index) => ({
    ...runtimeSeedData.runOfShowSegments[0],
    id: `${session.id}-segment`,
    eventId: event.id,
    segmentTitle: session.name,
    publicTitle: session.name,
    startAt: session.startAt,
    endAt: session.endAt,
    readinessStatus: index === 0 ? "ready" : runtimeSeedData.runOfShowSegments[0].readinessStatus,
  })) as SeedRunOfShow[];
}

function fallbackRuntimeEvent(eventId: string): SeedEvent {
  const base = runtimeSeedData.events[0];
  const safeEventId = eventId.trim() || base.id;
  const title = safeEventId
    .split(/[-_]+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Generated Virtual Event";
  return {
    ...base,
    id: safeEventId,
    slug: safeEventId,
    name: title,
    status: "registration_open",
    registrationEnabled: true,
    venueEnabled: true,
    description: `${title} generated from the requested venue event id.`,
    internalGoal: "Preserve requested runtime event identity instead of silently falling back to another event.",
    clientFacingGoal: `Operate ${title} with registration, venue, roles, and video readiness.`,
  } as SeedEvent;
}

/**
 * Seed read model plus every runtime event currently hydrated into the overlay.
 * Runtime events come first so a workspace that hydrated its list sees real
 * rows ahead of demo rows.
 */
export function getRuntimeData() {
  const overlayEvents = listOverlayEvents();
  if (!overlayEvents.length) return runtimeSeedData;
  const seedEventIds = new Set(runtimeSeedData.events.map((event) => event.id));
  const runtimeEvents = overlayEvents.filter((event) => !seedEventIds.has(event.id));
  const runtimeClients = new Map<string, SeedClient>();
  for (const event of runtimeEvents) runtimeClients.set(runtimeClientId(event), runtimeEventClient(event));
  return {
    ...runtimeSeedData,
    events: [...runtimeEvents.map(runtimeEventAsSeedEvent), ...runtimeSeedData.events],
    clients: [...Array.from(runtimeClients.values()), ...runtimeSeedData.clients],
    sessions: [...runtimeEvents.flatMap((event) => dynamicDraftSessions(event.id) || []), ...runtimeSeedData.sessions],
    runOfShowSegments: [...runtimeEvents.flatMap((event) => dynamicDraftRunOfShow(event.id) || []), ...runtimeSeedData.runOfShowSegments],
  };
}

export function getCurrentRuntimeUser() {
  return runtimeSeedUsers[0];
}

export function getRuntimeUsers() {
  return runtimeSeedUsers;
}

export function getEvent(eventId: string) {
  const normalizedEventId = eventId === "demo" ? "event-summit" : eventId;
  return dynamicDraftEvent(normalizedEventId) ?? runtimeSeedData.events.find((event) => event.id === normalizedEventId || event.slug === normalizedEventId) ?? fallbackRuntimeEvent(normalizedEventId);
}

/** True when the id belongs to a runtime-created (non-seed) event currently hydrated. */
export function isRuntimeCreatedEvent(eventId: string) {
  return Boolean(peekOverlayEvent(eventId));
}

export function getClient(clientId: string) {
  return getRuntimeData().clients.find((client) => client.id === clientId) ?? runtimeSeedData.clients[0];
}

export function getEventClient(eventId: string) {
  const event = getEvent(eventId);
  return getClient(event.clientId);
}

export function getClientBySlug(slug: string) {
  return runtimeSeedData.clients.find((client) => client.slug === slug) ?? runtimeSeedData.clients[0];
}

export function getEventBySlug(slug: string) {
  return dynamicDraftEvent(slug) ?? runtimeSeedData.events.find((event) => event.slug === slug) ?? fallbackRuntimeEvent(slug);
}

export function getTasksForEvent(eventId: string) {
  return runtimeSeedData.tasks.filter((task) => task.eventId === eventId);
}

export function getRunOfShowForEvent(eventId: string) {
  const runtime = dynamicDraftRunOfShow(eventId);
  if (runtime) return runtime;
  return runtimeSeedData.runOfShowSegments
    .filter((segment) => segment.eventId === eventId)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function getApprovalsForEvent(eventId: string) {
  return runtimeSeedData.approvals.filter((approval) => approval.eventId === eventId);
}

export function getAssetsForEvent(eventId: string) {
  return runtimeSeedData.assets.filter((asset) => asset.eventId === eventId || !asset.eventId);
}

export function getSpeakersForEvent(eventId: string) {
  return runtimeSeedData.speakers.filter((speaker) => speaker.eventId === eventId);
}

export function getSponsorsForEvent(eventId: string) {
  return runtimeSeedData.sponsors.filter((sponsor) => sponsor.eventId === eventId);
}

export function getSponsorBoothsForEvent(eventId: string) {
  return runtimeSeedData.sponsorBooths.filter((booth) => booth.eventId === eventId);
}

export function getSessionsForEvent(eventId: string) {
  const runtime = dynamicDraftSessions(eventId);
  if (runtime) return runtime;
  return runtimeSeedData.sessions.filter((session) => session.eventId === eventId);
}

export function getContractorAssignmentsForEvent(eventId: string) {
  return runtimeSeedData.contractorAssignments.filter((assignment) => assignment.eventId === eventId);
}

export function getVendorAssignmentsForEvent(eventId: string) {
  return runtimeSeedData.vendorAssignments.filter((assignment) => assignment.eventId === eventId);
}

export function getAnalyticsForEvent(eventId: string) {
  return runtimeSeedData.analyticsEvents.filter((event) => event.eventId === eventId);
}
