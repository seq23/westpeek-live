import type { AuditLog } from "@/types/core";
import type { V4AnalyticsEvent, V4RoomFallbackState, V4VideoProvider } from "@/types/v4";
import type { StageStreamEvent, StageStreamState } from "@/types/stageStream";
import type { LiveChatMessage, LiveChatModerationState } from "@/types/liveChat";
import type { AttendeeLiveCapability, AttendeeLiveControlState } from "@/types/attendeeLive";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { AttendeeAgendaIntent, AttendeePermission, AttendeeSession, SponsorLeadOptIn } from "@/types/attendeeSession";
import type { AgencySettingsRecord, RuntimeClientRecord, RuntimeEventRecord } from "@/types/runtimeEvent";

export interface V5AccessAttemptRuntimeEvent {
  id: string;
  status: "access_attempted" | "access_granted" | "access_denied" | "access_expired" | "access_revoked";
  accessKind: "attendee" | "crew" | "operator" | "owner" | "special_guest";
  eventId?: string;
  role?: string;
  route?: string;
  reason?: string;
  ipHash?: string;
  userAgentHash?: string;
  createdAt: string;
}

export interface V5FallbackRuntimeEvent {
  id: string;
  eventId: string;
  roomId: string;
  roomType: string;
  provider: V4VideoProvider;
  action: "auto_switch" | "manual_switch" | "rollback" | "health_check";
  actorRole?: string;
  reason?: string;
  createdAt: string;
}

export interface V6IncidentRuntimeEvent {
  id: string;
  eventId: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "monitoring" | "resolved";
  ownerRole: string;
  details: string;
  createdAt: string;
}

export interface V6SupportRequestRuntimeEvent {
  id: string;
  eventId: string;
  attendeeId?: string;
  subject: string;
  status: "open" | "triaged" | "resolved";
  createdAt: string;
}

export interface V6EmailRuntimeEvent {
  id: string;
  eventId: string;
  templateKey: string;
  recipientSegment: string;
  status: "queued" | "sent" | "blocked" | "failed";
  providerMessageId?: string;
  reason?: string;
  createdAt: string;
}

export interface V6RegistrationRuntimeEvent {
  id: string;
  eventId: string;
  attendeeEmailHash: string;
  status: "submitted" | "confirmed" | "cancelled";
  displayName?: string;
  company?: string;
  title?: string;
  personalWebsite?: string;
  socialLinks?: string[];
  reasonForAttending?: string;
  interestingFact?: string;
  createdAt: string;
}

export interface V6RunOfShowRuntimeEvent {
  id: string;
  eventId: string;
  segmentId: string;
  action: "mark_ready" | "mark_live" | "mark_complete" | "skip" | "delay" | "note";
  actorRole: string;
  createdAt: string;
}

export interface V6RuntimeSnapshot {
  auditLogs: AuditLog[];
  accessAttempts: V5AccessAttemptRuntimeEvent[];
  analyticsEvents: V4AnalyticsEvent[];
  fallbackEvents: V5FallbackRuntimeEvent[];
  fallbackStates: V4RoomFallbackState[];
  incidentEvents: V6IncidentRuntimeEvent[];
  supportRequests: V6SupportRequestRuntimeEvent[];
  emailEvents: V6EmailRuntimeEvent[];
  registrations: V6RegistrationRuntimeEvent[];
  attendeeProfiles: AttendeeProfile[];
  attendeeSessions: AttendeeSession[];
  attendeeAgendaIntents: AttendeeAgendaIntent[];
  sponsorLeadOptIns: SponsorLeadOptIn[];
  attendeePermissions: AttendeePermission[];
  runOfShowEvents: V6RunOfShowRuntimeEvent[];
  stageStreamStates: StageStreamState[];
  stageStreamEvents: StageStreamEvent[];
  liveChatMessages: LiveChatMessage[];
  liveChatModerationStates: LiveChatModerationState[];
  attendeeLiveCapabilities: AttendeeLiveCapability[];
  attendeeLiveControlStates: AttendeeLiveControlState[];
  runtimeEvents: RuntimeEventRecord[];
  runtimeClients: RuntimeClientRecord[];
  agencySettings: AgencySettingsRecord[];
}

export type RuntimeStoreKind = "supabase" | "file";

export interface RuntimeStore {
  /** Explicit, because class names are minified in the Worker bundle and cannot identify the store. */
  readonly kind: RuntimeStoreKind;
  appendAuditLog(log: AuditLog): Promise<AuditLog>;
  appendAccessAttempt(event: V5AccessAttemptRuntimeEvent): Promise<V5AccessAttemptRuntimeEvent>;
  appendAnalyticsEvent(event: V4AnalyticsEvent): Promise<V4AnalyticsEvent>;
  appendFallbackEvent(event: V5FallbackRuntimeEvent): Promise<V5FallbackRuntimeEvent>;
  getFallbackState(key: string): Promise<V4RoomFallbackState | undefined>;
  setFallbackState(key: string, state: V4RoomFallbackState): Promise<V4RoomFallbackState>;
  appendIncident(event: V6IncidentRuntimeEvent): Promise<V6IncidentRuntimeEvent>;
  appendSupportRequest(event: V6SupportRequestRuntimeEvent): Promise<V6SupportRequestRuntimeEvent>;
  appendEmailEvent(event: V6EmailRuntimeEvent): Promise<V6EmailRuntimeEvent>;
  appendRegistration(event: V6RegistrationRuntimeEvent): Promise<V6RegistrationRuntimeEvent>;
  upsertAttendeeProfile(profile: AttendeeProfile): Promise<AttendeeProfile>;
  getAttendeeProfile(eventId: string, attendeeId: string): Promise<AttendeeProfile | undefined>;
  getAttendeeProfileByEmailHash(eventId: string, emailHash: string): Promise<AttendeeProfile | undefined>;
  listAttendeeProfiles(eventId: string, limit?: number): Promise<AttendeeProfile[]>;
  upsertAttendeeSession(session: AttendeeSession): Promise<AttendeeSession>;
  getAttendeeSession(eventId: string, sessionId: string): Promise<AttendeeSession | undefined>;
  upsertAttendeeAgendaIntent(intent: AttendeeAgendaIntent): Promise<AttendeeAgendaIntent>;
  getAttendeeAgendaIntent(eventId: string, attendeeId: string): Promise<AttendeeAgendaIntent | undefined>;
  appendSponsorLeadOptIn(optIn: SponsorLeadOptIn): Promise<SponsorLeadOptIn>;
  upsertAttendeePermission(permission: AttendeePermission): Promise<AttendeePermission>;
  listAttendeePermissions(eventId: string, attendeeId: string): Promise<AttendeePermission[]>;
  appendRunOfShowEvent(event: V6RunOfShowRuntimeEvent): Promise<V6RunOfShowRuntimeEvent>;
  getStageStreamState(key: string): Promise<StageStreamState | undefined>;
  setStageStreamState(key: string, state: StageStreamState): Promise<StageStreamState>;
  appendStageStreamEvent(event: StageStreamEvent): Promise<StageStreamEvent>;
  appendLiveChatMessage(message: LiveChatMessage): Promise<LiveChatMessage>;
  /** Attendee listing by default (hidden messages excluded); crew surfaces pass includeHidden. */
  listLiveChatMessages(eventId: string, roomKind: string, roomId: string, options?: { includeHidden?: boolean }): Promise<LiveChatMessage[]>;
  /** Newest first, every room of the event, hidden included: the crew moderation queue. */
  listRecentLiveChatMessages(eventId: string, limit: number): Promise<LiveChatMessage[]>;
  updateLiveChatMessageModeration(input: { id: string; eventId: string; moderationStatus: LiveChatMessage["moderationStatus"]; moderatedBy: string; moderatedAt: string }): Promise<LiveChatMessage | undefined>;
  setLiveChatModerationState(state: LiveChatModerationState): Promise<LiveChatModerationState>;
  getLiveChatModerationState(key: string): Promise<LiveChatModerationState | undefined>;
  listLiveChatModerationStates(eventId: string): Promise<LiveChatModerationState[]>;
  setAttendeeLiveCapability(key: string, capability: AttendeeLiveCapability): Promise<AttendeeLiveCapability>;
  getAttendeeLiveCapability(key: string): Promise<AttendeeLiveCapability | undefined>;
  setAttendeeLiveControlState(key: string, state: AttendeeLiveControlState): Promise<AttendeeLiveControlState>;
  getAttendeeLiveControlState(key: string): Promise<AttendeeLiveControlState | undefined>;
  readSnapshot(): Promise<V6RuntimeSnapshot>;
  // Runtime-created events, clients, and agency settings (migration 0024).
  upsertRuntimeEvent(event: RuntimeEventRecord): Promise<RuntimeEventRecord>;
  getRuntimeEvent(idOrSlugOrJoinCode: string): Promise<RuntimeEventRecord | undefined>;
  listRuntimeEvents(): Promise<RuntimeEventRecord[]>;
  upsertRuntimeClient(client: RuntimeClientRecord): Promise<RuntimeClientRecord>;
  listRuntimeClients(): Promise<RuntimeClientRecord[]>;
  getAgencySettings(id: string): Promise<AgencySettingsRecord | undefined>;
  setAgencySettings(settings: AgencySettingsRecord): Promise<AgencySettingsRecord>;
}

export function emptyRuntimeSnapshot(): V6RuntimeSnapshot {
  return {
    auditLogs: [],
    accessAttempts: [],
    analyticsEvents: [],
    fallbackEvents: [],
    fallbackStates: [],
    incidentEvents: [],
    supportRequests: [],
    emailEvents: [],
    registrations: [],
    attendeeProfiles: [],
    attendeeSessions: [],
    attendeeAgendaIntents: [],
    sponsorLeadOptIns: [],
    attendeePermissions: [],
    runOfShowEvents: [],
    stageStreamStates: [],
    stageStreamEvents: [],
    liveChatMessages: [],
    liveChatModerationStates: [],
    attendeeLiveCapabilities: [],
    attendeeLiveControlStates: [],
    runtimeEvents: [],
    runtimeClients: [],
    agencySettings: [],
  };
}
