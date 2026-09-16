/**
 * The event's pages, grouped the way a producer actually works: Overview, Plan, People, Comms,
 * Show day, After, Publish. One list, used by the spine, the mobile drawer and the validator, so a
 * page can never quietly exist without a way in — or appear in two groups.
 */
export interface SpineEntry {
  /** Path segment under /app/events/[eventId]; "" is the event's own page. */
  path: string;
  label: string;
  blurb: string;
  /** Only where something real is measured — three things the store can actually answer today. */
  readiness?: "speakers" | "run-of-show" | "publish";
}

export interface SpineGroup {
  id: string;
  title: string;
  entries: SpineEntry[];
}

export const EVENT_SPINE: SpineGroup[] = [
  {
    id: "overview",
    title: "Overview",
    entries: [
      { path: "", label: "Command centre", blurb: "Everything at a glance: roster, tasks, what production is doing now." },
      { path: "overview", label: "Event overview", blurb: "The event's own facts: format, client, when, whether it is published." },
      { path: "setup", label: "Setup", blurb: "Name, date, client, description — the fields the event is made of." },
      { path: "branding", label: "Branding", blurb: "Logo and colours the venue wears." },
    ],
  },
  {
    id: "plan",
    title: "Plan",
    entries: [
      { path: "agenda", label: "Agenda", blurb: "Sessions and their timing." },
      { path: "run-of-show", label: "Run of show", blurb: "The show caller's spine and live cues.", readiness: "run-of-show" },
      { path: "venue", label: "Venue setup", blurb: "Lobby, stage, expo, networking, replay, help." },
      { path: "attendee-flow", label: "Attendee flow", blurb: "What an attendee meets, in order, from link to replay." },
      { path: "tasks", label: "Tasks", blurb: "Who is doing what before the doors open." },
      { path: "assets", label: "Assets", blurb: "Decks, graphics, and anything a speaker or sponsor sends." },
      { path: "builder", label: "Builder", blurb: "The guided build of the event." },
    ],
  },
  {
    id: "people",
    title: "People",
    entries: [
      { path: "speakers", label: "Speakers", blurb: "Who is speaking, their tech check, their cue deck.", readiness: "speakers" },
      { path: "sponsors", label: "Sponsors", blurb: "Booths, leads, what each sponsor was promised." },
      { path: "crew", label: "Crew briefing", blurb: "The call sheet and instructions the crew read." },
      { path: "talent", label: "Contractors", blurb: "The people you hire for this event and what they cost." },
      { path: "vendors", label: "Vendors", blurb: "Companies supplying a service for this event." },
      { path: "access", label: "Access codes", blurb: "Join code and the role codes, with the links." },
    ],
  },
  {
    id: "comms",
    title: "Comms",
    entries: [
      { path: "communications", label: "Communications", blurb: "What has been sent to this event's audience, and what you can send now." },
      { path: "inbox", label: "Production inbox", blurb: "Everything that came in: match it, file it, or turn it into work." },
      { path: "approval-queue", label: "Approval queue", blurb: "What is waiting on a yes, and from whom." },
      { path: "change-control", label: "Change control", blurb: "Last-minute changes, approved and reversible." },
    ],
  },
  {
    id: "show-day",
    title: "Show day",
    entries: [
      { path: "preview", label: "Preview", blurb: "The preflight walk-through before you open the doors." },
      { path: "video/main-stage", label: "Main stage", blurb: "The stage room as production sees it." },
      { path: "video/green-room", label: "Green room", blurb: "Where speakers wait and check themselves." },
      { path: "video/backstage", label: "Backstage", blurb: "The private room behind the stage." },
      { path: "video-health", label: "Video health", blurb: "LiveKit, Cloudflare Stream, Daily, Zoom, Meet — which rung is ready." },
      { path: "incidents", label: "Incidents", blurb: "What went wrong, when, and what was done." },
    ],
  },
  {
    id: "after",
    title: "After",
    entries: [
      { path: "analytics", label: "Analytics", blurb: "Who came, how long they stayed, what they did." },
      { path: "report", label: "Reports", blurb: "The report you hand the client." },
    ],
  },
  {
    id: "publish",
    title: "Publish",
    entries: [
      { path: "publish", label: "Publish", blurb: "Readiness, then the public page goes live.", readiness: "publish" },
    ],
  },
];

/** Pages that existed twice; each now redirects to the one that stayed. */
export const SPINE_REDIRECTS: Record<string, string> = {
  producer: "",
  timeline: "tasks",
  approvals: "approval-queue",
};

export function spineHref(eventId: string, path: string) {
  return path ? `/app/events/${eventId}/${path}` : `/app/events/${eventId}`;
}

export function spineEntries() {
  return EVENT_SPINE.flatMap((group) => group.entries);
}
