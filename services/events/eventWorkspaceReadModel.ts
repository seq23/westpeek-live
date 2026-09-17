import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import { listSpeakerCueDecks, listSpeakerStageStates, listSpeakerTechChecks, listSponsorBooths } from "@/services/guests/guestStateService";
import { listEventAssets } from "@/services/assets/eventAssetService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";
import type { SpeakerStageStatus, SponsorBoothState } from "@/types/specialGuest";

/**
 * What the workspace knows about a REAL event — the one the owner created — read from the runtime
 * store and from nowhere else. Every page under app/app/events/[eventId] that used to render
 * compiled demo fixtures reads this instead, and renders an honest empty state where a list comes
 * back empty (16 Sep 2026).
 *
 * The store's coverage is uneven and this model does not paper over that. Speakers, sponsors,
 * booths, sessions, assets, registrations and analytics have real rows. Tasks and milestones have
 * NO runtime table at all, so no read model is offered for them and the page says so in the
 * owner's words rather than borrowing the demo summit's task list.
 */
export interface WorkspaceSpeaker {
  guestId: string;
  name: string;
  company: string;
  title: string;
  stage: SpeakerStageStatus;
  techCheck: "not_recorded" | "not_ready" | "ready" | "warnings";
  cueDeckApproved: boolean;
  cueDeckPending: boolean;
}

export interface WorkspaceSponsor {
  guestId: string;
  name: string;
  company: string;
  title: string;
  booth?: SponsorBoothState;
}

export interface WorkspaceSegment {
  id: string;
  title: string;
  room: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
}

export interface WorkspaceReadinessItem {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
}

export interface EventWorkspaceReadModel {
  event: RuntimeEventRecord;
  speakers: WorkspaceSpeaker[];
  sponsors: WorkspaceSponsor[];
  segments: WorkspaceSegment[];
  assetsTotal: number;
  assetsInReview: number;
  registrations: number;
  analyticsEvents: number;
  readiness: WorkspaceReadinessItem[];
}

function minutesBetween(startAt: string, endAt: string) {
  const span = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Number.isFinite(span) ? Math.max(1, Math.round(span / 60_000)) : 0;
}

/**
 * The event's own sessions, as the producer entered them. An event created with no session still
 * runs one main stage, which is how the venue and the join code already treat it, so it is shown
 * as one segment rather than as nothing.
 */
export function workspaceSegments(event: RuntimeEventRecord): WorkspaceSegment[] {
  const sessions = event.sessions.length ? event.sessions : [{ id: `${event.id}-main-stage`, title: "Main stage", room: "Main Stage", startAt: event.startAt, endAt: event.endAt }];
  return sessions
    .map((session) => ({ id: session.id, title: session.title, room: session.room || "Main Stage", startAt: session.startAt, endAt: session.endAt, durationMinutes: minutesBetween(session.startAt, session.endAt) }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function listWorkspaceSpeakers(eventId: string): Promise<WorkspaceSpeaker[]> {
  const [profiles, stages, techChecks, decks] = await Promise.all([
    listGuestProfiles(eventId, "speaker").catch(() => []),
    listSpeakerStageStates(eventId).catch(() => []),
    listSpeakerTechChecks(eventId).catch(() => []),
    listSpeakerCueDecks(eventId).catch(() => []),
  ]);
  const stageOf = new Map(stages.map((item) => [item.guestId, item.state]));
  const techOf = new Map(techChecks.map((item) => [item.guestId, item.state]));
  const deckOf = new Map(decks.map((item) => [item.guestId, item.state]));
  return profiles.map((profile) => ({
    guestId: profile.guestId,
    name: profile.name,
    company: profile.company,
    title: profile.title,
    stage: stageOf.get(profile.guestId)?.status || "backstage",
    techCheck: techOf.get(profile.guestId)?.status || "not_recorded",
    cueDeckApproved: Boolean(deckOf.get(profile.guestId)?.approved),
    cueDeckPending: Boolean(deckOf.get(profile.guestId)?.pending),
  }));
}

export async function listWorkspaceSponsors(eventId: string): Promise<WorkspaceSponsor[]> {
  const [profiles, booths] = await Promise.all([listGuestProfiles(eventId, "sponsor").catch(() => []), listSponsorBooths(eventId).catch(() => [])]);
  const boothOf = new Map(booths.map((item) => [item.guestId, item.state]));
  return profiles.map((profile) => ({ guestId: profile.guestId, name: profile.name, company: profile.company, title: profile.title, booth: boothOf.get(profile.guestId) }));
}

/**
 * Readiness as a count of checks that have a runtime signal behind them, never a score. The old
 * percentage was computed from the seed arrays: an event created a minute earlier scored 87% ready
 * because every fixture list it filtered came back empty and an empty list scored full marks.
 */
export function workspaceReadiness(input: { event: RuntimeEventRecord; speakers: WorkspaceSpeaker[]; sponsors: WorkspaceSponsor[]; segments: WorkspaceSegment[]; assetsInReview: number }): WorkspaceReadinessItem[] {
  const { event, speakers, sponsors, segments, assetsInReview } = input;
  const techChecked = speakers.filter((speaker) => speaker.techCheck === "ready").length;
  const publishedBooths = sponsors.filter((sponsor) => sponsor.booth?.published).length;
  return [
    { id: "basics", label: "Event basics", ready: Boolean(event.name && event.startAt && event.timezone), detail: `${event.name} · starts ${event.startAt} · ${event.timezone}.` },
    { id: "run-of-show", label: "Run of show", ready: segments.length > 0, detail: `${segments.length} segment${segments.length === 1 ? "" : "s"} on the timeline.` },
    { id: "speakers", label: "Speakers", ready: speakers.length > 0, detail: speakers.length ? `${speakers.length} speaker${speakers.length === 1 ? "" : "s"} have entered with the speaker code.` : "No speaker has entered with the speaker code yet." },
    { id: "tech-checks", label: "Tech checks", ready: speakers.length > 0 && techChecked === speakers.length, detail: `${techChecked} of ${speakers.length} speaker tech checks recorded.` },
    { id: "sponsors", label: "Sponsors", ready: sponsors.length === 0 || publishedBooths === sponsors.length, detail: sponsors.length ? `${publishedBooths} of ${sponsors.length} sponsor booths published.` : "No sponsors on this event." },
    { id: "assets", label: "Assets", ready: assetsInReview === 0, detail: assetsInReview ? `${assetsInReview} file${assetsInReview === 1 ? "" : "s"} waiting for review.` : "Nothing waiting for review." },
    { id: "published", label: "Published", ready: event.status !== "draft", detail: `Status is ${event.status.replaceAll("_", " ")}.` },
  ];
}

export async function getEventWorkspaceReadModel(event: RuntimeEventRecord): Promise<EventWorkspaceReadModel> {
  const [speakers, sponsors, assets, snapshot] = await Promise.all([
    listWorkspaceSpeakers(event.id),
    listWorkspaceSponsors(event.id),
    listEventAssets(event.id).catch(() => []),
    getRuntimeStore().readSnapshot().catch(() => undefined),
  ]);
  const segments = workspaceSegments(event);
  const assetsInReview = assets.filter((asset) => asset.status === "in_review").length;
  return {
    event,
    speakers,
    sponsors,
    segments,
    assetsTotal: assets.length,
    assetsInReview,
    registrations: snapshot ? snapshot.registrations.filter((item) => item.eventId === event.id).length : 0,
    analyticsEvents: snapshot ? snapshot.analyticsEvents.filter((item) => item.eventId === event.id).length : 0,
    readiness: workspaceReadiness({ event, speakers, sponsors, segments, assetsInReview }),
  };
}
