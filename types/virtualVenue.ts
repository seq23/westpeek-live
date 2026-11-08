export type VenueSurface =
  | "lobby"
  | "stage"
  | "sessions"
  | "breakouts"
  | "expo"
  | "networking"
  | "people"
  | "replay"
  | "run-of-show"
  | "help";

export type VenueSurfaceStatus = "live" | "open" | "upcoming" | "available" | "closed" | "processing";

export interface VenueNavItem {
  surface: VenueSurface;
  label: string;
  href: string;
  status: VenueSurfaceStatus;
}

export interface VirtualVenueSession {
  id: string;
  title: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  status: "live" | "upcoming" | "completed";
  roomHref: string;
  speakerNames: string[];
}

export interface VirtualVenueBreakout {
  id: string;
  title: string;
  description: string;
  hostName: string;
  capacity: number;
  currentCount: number;
  status: VenueSurfaceStatus;
  href: string;
}

export interface VirtualVenueBooth {
  id: string;
  name: string;
  headline: string;
  description: string;
  href: string;
  ctaLabel: string;
}

export interface VirtualVenuePerson {
  id: string;
  displayName: string;
  company?: string;
  title?: string;
  personalWebsite?: string;
  socialLinks?: string[];
  reasonForAttending?: string;
  interestingFact?: string;
  attendeeType?: "speaker" | "sponsor" | "attendee" | "vip" | "client" | "crew";
  networkingOptIn: boolean;
}

export interface VirtualVenueReplay {
  id: string;
  title: string;
  status: "not_available" | "processing" | "available" | "restricted";
  durationSeconds?: number;
  href: string;
  /** Where the recording plays. A replay is "available" only when this exists. */
  playbackUrl?: string;
}

export interface VirtualVenueModel {
  eventId: string;
  eventName: string;
  nav: VenueNavItem[];
  liveNow: VirtualVenueSession[];
  upNext: VirtualVenueSession[];
  sessions: VirtualVenueSession[];
  breakouts: VirtualVenueBreakout[];
  booths: VirtualVenueBooth[];
  people: VirtualVenuePerson[];
  replays: VirtualVenueReplay[];
  helpTopics: string[];
}
