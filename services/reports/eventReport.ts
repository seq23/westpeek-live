import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { V6RuntimeSnapshot } from "@/services/runtime/runtimeStore";
import { getEventShow, type EventShow } from "@/services/run-of-show/eventShow";
import { segmentTiming } from "@/services/run-of-show/showProgress";
import { listEventIncidents, type Incident } from "@/services/incidents/incidentLog";

/**
 * The post-event report: every figure is something this event actually wrote down, counted the
 * same way for the producer's report page and the client portal. A thing the app does not record
 * (peak concurrent viewers, watch time) is not on the list at all — never a zero, never a guess.
 */
export interface ReportFigure {
  id: string;
  label: string;
  value: number;
  /** One plain line on what was counted. */
  note: string;
}

export interface ReportSection {
  id: "audience" | "engagement" | "show";
  title: string;
  figures: ReportFigure[];
}

export interface EventReport {
  eventId: string;
  sections: ReportSection[];
  /** Per-segment timing, only for segments the producer marked live (the rest are "not timed"). */
  segments: Array<{ id: string; title: string; timing: ReturnType<typeof segmentTiming>; startedLateMinutes: number; overranMinutes: number }>;
  /** True when anything at all was recorded; the page shows an honest empty state otherwise. */
  hasData: boolean;
}

type ReportSnapshot = Pick<V6RuntimeSnapshot, "registrations" | "attendeeProfiles" | "attendeeSessions" | "analyticsEvents" | "attendeeLiveCapabilities" | "liveChatMessages" | "supportRequests">;

const figure = (id: string, label: string, value: number, note: string): ReportFigure => ({ id, label, value, note });

/** Pure: the report from what was recorded. Kept apart from the store reads so it can be tested. */
export function buildEventReport(eventId: string, snapshot: ReportSnapshot, show: EventShow, incidents: Incident[]): EventReport {
  const mine = <T extends { eventId: string }>(rows: T[]) => rows.filter((row) => row.eventId === eventId);
  const analytics = mine(snapshot.analyticsEvents);
  const kind = (name: string) => analytics.filter((item) => item.kind === name).length;

  const profiles = mine(snapshot.attendeeProfiles);
  const registrationHashes = new Set(mine(snapshot.registrations).filter((item) => item.status !== "cancelled").map((item) => item.attendeeEmailHash));
  const registered = Math.max(profiles.length, registrationHashes.size);
  const seenInVenue = new Set(mine(snapshot.attendeeSessions).filter((item) => item.lastSeenAt).map((item) => item.attendeeId)).size;

  const stageRequests = mine(snapshot.attendeeLiveCapabilities).filter((item) => item.requestedAt || item.requestStatus);
  const chat = mine(snapshot.liveChatMessages);

  const segments = show.segments.map((run) => ({ id: run.segment.id, title: run.segment.title, timing: segmentTiming(run), startedLateMinutes: run.startedLateMinutes, overranMinutes: run.overranMinutes }));
  const count = (timing: string) => segments.filter((segment) => segment.timing === timing).length;

  const audience: ReportFigure[] = [
    figure("registered", "Registered", registered, "people who registered for this event"),
    figure("seen-in-venue", "Came in", seenInVenue, "registered people whose browser was seen in the venue"),
    figure("lobby-joins", "Lobby visits", kind("attendee_joined_lobby"), "times the lobby was opened"),
    figure("stage-joins", "Main stage joins", kind("attendee_joined_session"), "times the stage or a session was joined"),
  ];
  const engagement: ReportFigure[] = [
    figure("questions", "Questions asked", kind("question_asked"), "questions sent from the venue"),
    figure("stage-requests", "Requests to speak", stageRequests.length, "people who asked to come on stage"),
    figure("stage-approved", "Brought on stage", stageRequests.filter((item) => item.requestStatus === "approved").length, "requests to speak the crew approved"),
    figure("chat", "Chat messages", chat.length, "messages posted in the event's chat"),
    figure("booth-visits", "Sponsor booth visits", kind("attendee_visited_sponsor_booth"), "visits to sponsor booths"),
    figure("sponsor-clicks", "Sponsor link clicks", kind("sponsor_cta_clicked"), "clicks on a sponsor's call to action"),
    figure("networking", "Networking joins", kind("networking_joined"), "times someone joined speed networking"),
    figure("replays", "Replay views", kind("replay_watched"), "replays watched"),
    figure("support", "Help requests", mine(snapshot.supportRequests).length, "requests for help from attendees"),
    figure("analytics", "Recorded moments", analytics.length, "every attendee action the app wrote down"),
  ];
  const show_: ReportFigure[] = [
    figure("segments", "Segments", show.total, "on the run of show"),
    figure("on-time", "Ran on time", count("on_time"), "marked live within 2 minutes of the slot and not run over"),
    figure("late", "Ran late", count("late"), "started or finished 2 minutes or more past the slot"),
    figure("skipped", "Skipped", count("skipped"), "passed by the producer"),
    figure("not-timed", "Not timed", count("not_timed"), "ran by the clock without a producer mark, so there is no real start time"),
    figure("incidents", "Incidents", incidents.length, "logged in the incident log"),
    figure("incidents-serious", "Serious incidents", incidents.filter((item) => item.severity === "high" || item.severity === "critical").length, "high or critical"),
    figure("incidents-open", "Incidents still open", incidents.filter((item) => item.status !== "resolved").length, "not yet marked resolved"),
  ];
  // Engagement lists only what happened: a booth-visit zero on an event with no sponsors is noise.
  // The audience and the show's core lines always show, because their zero is itself the answer.
  const optionalShow = new Set(["skipped", "not-timed", "incidents-serious", "incidents-open"]);
  const sections: ReportSection[] = [
    { id: "audience", title: "Audience", figures: audience },
    { id: "engagement", title: "Engagement", figures: engagement.filter((item) => item.value > 0) },
    { id: "show", title: "The show", figures: show_.filter((item) => !optionalShow.has(item.id) || item.value > 0) },
  ];
  const hasData = registered > 0 || analytics.length > 0 || chat.length > 0 || incidents.length > 0 || segments.some((segment) => segment.timing !== "not_run");
  return { eventId, sections, segments, hasData };
}

export async function getEventReport(eventId: string): Promise<EventReport> {
  const [snapshot, show, incidents] = await Promise.all([getRuntimeStore().readSnapshot(), getEventShow(eventId), listEventIncidents(eventId)]);
  return buildEventReport(eventId, snapshot, show, incidents);
}
