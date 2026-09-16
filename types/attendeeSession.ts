export interface AttendeeSession {
  sessionId: string;
  attendeeId: string;
  eventId: string;
  role: "attendee";
  status: "active" | "revoked" | "expired";
  issuedAt: string;
  expiresAt: string;
  lastSeenAt?: string;
  /**
   * What this attendee's own browser reports, because LiveKit cannot: the bundle it is running, the
   * quality it is getting, and how many stage tracks it is actually subscribed to. Together with the
   * LiveKit participant row these separate "never connected" from "connected and receiving nothing"
   * from "receiving it badly". Never a raw user agent, never an IP, never a location.
   */
  clientBuildId?: string;
  /** The derived label the Diagnose panel prints, e.g. "Chrome 140 on macOS". */
  clientBrowser?: string;
  clientConnectionQuality?: "excellent" | "good" | "poor" | "lost" | "unknown";
  clientSubscribedTracks?: number;
  /** Which venue page they were last on ("stage", "lobby", …). */
  clientSurface?: string;
  lastChatPollAt?: string;
}

export interface AttendeeAgendaIntent {
  id: string;
  attendeeId: string;
  eventId: string;
  plannedSessionIds: string[];
  plannedBreakoutIds: string[];
  plannedSponsorBoothIds: string[];
  wantsSessionReminders: boolean;
  updatedAt: string;
}

export interface SponsorLeadOptIn {
  id: string;
  attendeeId: string;
  eventId: string;
  sponsorBoothId: string;
  allowedFields: string[];
  createdAt: string;
}


export interface AttendeePermission {
  id: string;
  attendeeId: string;
  eventId: string;
  permissionKind: "venue_access" | "chat" | "networking" | "help" | "sponsor_opt_in" | "stage_publish" | "restricted_session";
  granted: boolean;
  grantedBy?: string;
  reason?: string;
  updatedAt: string;
}
