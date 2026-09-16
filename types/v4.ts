export type V4PublicEventState = "draft" | "upcoming" | "open" | "live" | "ended" | "archived";
export type V4PublishState = "draft" | "ready_for_review" | "approved" | "published" | "live" | "ended" | "archived";
export type V4AccessKind = "attendee" | "crew" | "operator" | "owner" | "special_guest";
export type V4SpecialGuestRole = "client" | "speaker" | "sponsor" | "crew_lite" | "vip";
export type V4CrewRole = "crew" | "executive_producer" | "producer" | "technical_director" | "show_caller" | "moderator" | "va" | "support";
export type V4RoomType = "main_stage" | "backstage" | "breakout_session" | "networking_match" | "sponsor_booth" | "rehearsal_room";
export type V4VideoProvider = "livekit" | "cloudflare_stream" | "daily" | "zoom" | "google_meet";
export type V4HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface V4JoinResolution {
  ok: boolean;
  eventId?: string;
  eventSlug?: string;
  eventName?: string;
  publicState?: V4PublicEventState;
  destination?: string;
  reason?: "missing_code" | "invalid_code" | "not_public" | "registration_required" | "ended" | "archived";
  message: string;
}

export interface V4AccessResolution {
  ok: boolean;
  accessKind: V4AccessKind;
  eventId?: string;
  clientSlug?: string;
  role?: V4SpecialGuestRole | V4CrewRole;
  destination?: string;
  reason?: "missing_code" | "invalid_event" | "invalid_role_code" | "invalid_password" | "expired" | "forbidden";
  message: string;
}

export interface V4RoomFallbackState {
  eventId: string;
  roomId: string;
  roomType: V4RoomType;
  activeProvider: V4VideoProvider;
  health: Record<V4VideoProvider, V4HealthStatus>;
  automaticFallbackEnabled: boolean;
  manualOverrideProvider?: V4VideoProvider;
  rollbackAvailable: boolean;
  lastCheckedAt: string;
  auditEventIds: string[];
}

export interface V4AnalyticsEvent {
  id: string;
  eventId: string;
  kind:
    | "attendee_joined_lobby"
    | "attendee_joined_session"
    | "attendee_visited_sponsor_booth"
    | "sponsor_cta_clicked"
    | "support_requested"
    | "replay_watched"
    | "networking_joined"
    | "registration_submitted"
    /** A second device restored an existing registration from the email alone (no privilege carried). */
    | "registration_restored_on_new_device"
    | "question_asked";
  subjectId?: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}
