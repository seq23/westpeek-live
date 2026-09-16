export type CrewBriefingSection = {
  title: string;
  items: string[];
};

export const crewBriefing = {
  eventId: "event-summit",
  eventAlias: "demo",
  eventName: "West Peek Live Demo Summit",
  callTime: "9:00 AM local event time",
  showStart: "10:00 AM local event time",
  timezone: "Event local timezone",
  escalationEmail: "info@westpeek.ventures",
  operatorRole: "Executive Producer / Operator",
  sections: [
    {
      title: "What crew should do first",
      items: [
        "Open the Crew Home surface and confirm the event name, call time, and assigned show-day responsibilities.",
        "Review the Call Sheet before touching stage, chat, sponsor, speaker, or attendee-facing surfaces.",
        "Review the Run of Show before the event goes live.",
        "Use Tasks for execution status. Do not improvise changes outside the assigned task list.",
        "Escalate blockers through the listed support contact instead of guessing."
      ],
    },
    {
      title: "Show-day operating rules",
      items: [
        "Do not use the Operator Launchpad unless you were explicitly assigned operator access.",
        "Do not create events, publish events, change billing/settings, or access admin diagnostics.",
        "Do not share crew, operator, speaker, sponsor, VIP, or client access passwords in public chat.",
        "Do not approve attendee camera or microphone access unless production has directed it.",
        "If a route refuses access, treat that as an access boundary and escalate rather than bypassing it."
      ],
    },
    {
      title: "Video and fallback instructions",
      items: [
        "Production feed/source is StreamYard unless production announces otherwise.",
        "Primary embedded venue distribution is LiveKit.",
        "Daily is the secondary embedded fallback candidate.",
        "Zoom and Google Meet are white-label backup room links, not the core event engine.",
        "If the stage degrades, follow the fallback banner and operator instructions.",
        "Never expose private room URLs or provider credentials to attendees."
      ],
    },
    {
      title: "Escalation",
      items: [
        "For access, venue, livestream, or routing issues, email info@westpeek.ventures.",
        "Include the event name, route URL, role being used, browser/device, and what happened.",
        "Do not include passwords, secret keys, private room URLs, API keys, or production credentials in email."
      ],
    },
  ] satisfies CrewBriefingSection[],
};

export const crewTasks = [
  "Confirm venue lobby, stage, sessions, networking, expo, replay, and help surfaces load before doors open.",
  "Confirm call sheet assignments and escalation contact are visible.",
  "Confirm run of show timing and cue order before the first live segment.",
  "Monitor stage health and fallback language during the event.",
  "Capture incidents and escalate anything that blocks attendees, speakers, sponsors, clients, or production.",
];

export const crewRunOfShow = [
  { time: "T-60", cue: "Crew call", owner: "Crew Lead", note: "Open crew home, call sheet, run of show, and tasks." },
  { time: "T-45", cue: "Venue route check", owner: "Crew", note: "Check lobby, stage, sessions, expo, networking, replay, and help." },
  { time: "T-30", cue: "Video/fallback check", owner: "Production", note: "Confirm StreamYard production feed, LiveKit embedded distribution, and Daily / Zoom / Google Meet fallback context." },
  { time: "T-15", cue: "Access gate check", owner: "Crew Lead", note: "Confirm crew, special guest, and attendee entry paths are coherent." },
  { time: "LIVE", cue: "Monitor show", owner: "Crew", note: "Watch stage, chat, help, networking, incidents, and escalation." },
];

export function normalizeCrewEventId(eventId: string) {
  return eventId === "demo" ? "event-summit" : eventId;
}

export const CREW_CALL_LEAD_MINUTES = 60;

export type CrewCallTimes = { callTime: string; showStart: string; source: "runtime" | "seed" };

function crewClock(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  try {
    return new Intl.DateTimeFormat("en", { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(date);
  }
}

/**
 * "Call time: 9:00 AM local event time · Show start: 10:00 AM local event time" is what the crew
 * read on 16 Sep 2026 for a real event starting at 6:00 AM Chicago — the demo summit's words on a
 * runtime event's briefing. A runtime event derives both from its own start, in its own zone:
 * call time is the start minus one hour (the T-60 "Crew call" cue), show start is the start.
 * The seed text is kept for the compiled demo events only.
 */
export function crewCallTimesFor(event: { startAt?: string; timezone?: string; source?: string } | undefined): CrewCallTimes {
  if (!event || event.source === "seed" || !event.startAt) return { callTime: crewBriefing.callTime, showStart: crewBriefing.showStart, source: "seed" };
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return { callTime: crewBriefing.callTime, showStart: crewBriefing.showStart, source: "seed" };
  const zone = event.timezone?.trim() || "UTC";
  const call = new Date(start.getTime() - CREW_CALL_LEAD_MINUTES * 60_000);
  return { callTime: crewClock(call.toISOString(), zone), showStart: crewClock(start.toISOString(), zone), source: "runtime" };
}
