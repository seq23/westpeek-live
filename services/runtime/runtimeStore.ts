import type { AuditLog } from "@/types/core";
import type { V4AnalyticsEvent, V4RoomFallbackState, V4VideoProvider } from "@/types/v4";
import type { StageStreamEvent, StageStreamState } from "@/types/stageStream";
import type { LiveChatMessage, LiveChatModerationState, LiveChatRateState } from "@/types/liveChat";
import type { AttendeeLiveCapability, AttendeeLiveControlState } from "@/types/attendeeLive";
import type { AttendeeProfile, ContactRecord } from "@/types/attendeeRegistration";
import type { EventAssetRecord } from "@/types/eventAssets";
import type { SupplierEventLink, SupplierRecord } from "@/types/suppliers";
import type { EmailSendLog } from "@/types/emailProduction";
import type { EventTemplateRecord } from "@/types/eventTemplates";
import type { AttendeeAgendaIntent, AttendeePermission, AttendeeSession, SponsorLeadOptIn } from "@/types/attendeeSession";
import type { AgencySettingsRecord, RuntimeClientRecord, RuntimeEventRecord } from "@/types/runtimeEvent";
import type { EventRequestRecord } from "@/types/eventRequest";
import type { HowItWorksAudience, HowItWorksPageRecord } from "@/types/howItWorks";
import type { EventGuestStateRecord, SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";
import type { SpeedNetworkingMatchRecord, SpeedNetworkingQueueEntry } from "@/types/speedNetworking";

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
  liveChatRateStates: LiveChatRateState[];
  attendeeLiveCapabilities: AttendeeLiveCapability[];
  attendeeLiveControlStates: AttendeeLiveControlState[];
  specialGuestProfiles: SpecialGuestProfile[];
  eventGuestStates: EventGuestStateRecord[];
  speedNetworkingEntries: SpeedNetworkingQueueEntry[];
  speedNetworkingMatches: SpeedNetworkingMatchRecord[];
  contacts: ContactRecord[];
  eventAssets: EventAssetRecord[];
  suppliers: SupplierRecord[];
  supplierEventLinks: SupplierEventLink[];
  emailSendLogs: EmailSendLog[];
  eventTemplates: EventTemplateRecord[];
  runtimeEvents: RuntimeEventRecord[];
  runtimeClients: RuntimeClientRecord[];
  agencySettings: AgencySettingsRecord[];
  eventRequests: EventRequestRecord[];
  howItWorksPages: HowItWorksPageRecord[];
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
  /** The same person at ANY event (rows share the email hash) — the heal path for rows registered before the raw email was kept. */
  listAttendeeProfilesByEmailHash(emailHash: string): Promise<AttendeeProfile[]>;
  /** Rows registered before 16 Sep 2026: email null, only the hash. The People page lists them grouped by hash. */
  listAttendeeProfilesWithoutEmail(limit?: number): Promise<AttendeeProfile[]>;
  // Contacts across events (migration 0029), keyed by lowercased email.
  upsertContact(contact: ContactRecord): Promise<ContactRecord>;
  getContact(email: string): Promise<ContactRecord | undefined>;
  listContacts(): Promise<ContactRecord[]>;
  /** Reads contacts.archived_at alone (migration 0030). Throws when the column is missing, so the health probe names it. */
  probeContactsArchiveColumn(): Promise<{ ok: true }>;
  // Event assets (migration 0031): a real file in Supabase Storage, or a pasted link.
  upsertEventAsset(asset: EventAssetRecord): Promise<EventAssetRecord>;
  getEventAsset(id: string): Promise<EventAssetRecord | undefined>;
  listEventAssets(eventId: string, includeArchived?: boolean): Promise<EventAssetRecord[]>;
  listAllEventAssets(includeArchived?: boolean): Promise<EventAssetRecord[]>;
  // Contractors and vendors (migration 0033): one table, `kind` tells them apart. Suppliers are
  // global; supplier_event_links is which events each one is on.
  upsertSupplier(supplier: SupplierRecord): Promise<SupplierRecord>;
  getSupplier(id: string): Promise<SupplierRecord | undefined>;
  listSuppliers(includeArchived?: boolean): Promise<SupplierRecord[]>;
  upsertSupplierEventLink(link: SupplierEventLink): Promise<SupplierEventLink>;
  deleteSupplierEventLink(supplierId: string, eventId: string): Promise<void>;
  listSupplierEventLinks(): Promise<SupplierEventLink[]>;
  // The email send log (migration 0032): one row per message the app actually sent.
  appendEmailSendLog(log: EmailSendLog & { sentBy?: string }): Promise<EmailSendLog>;
  listEmailSendLogs(eventId: string, limit?: number): Promise<Array<EmailSendLog & { sentBy?: string }>>;
  listAllEmailSendLogs(limit?: number): Promise<Array<EmailSendLog & { sentBy?: string }>>;
  // Event templates (migration 0033): a starting point for an event, saved from a real one.
  upsertEventTemplate(template: EventTemplateRecord): Promise<EventTemplateRecord>;
  getEventTemplate(id: string): Promise<EventTemplateRecord | undefined>;
  listEventTemplates(): Promise<EventTemplateRecord[]>;
  deleteEventTemplate(id: string): Promise<void>;
  upsertAttendeeSession(session: AttendeeSession): Promise<AttendeeSession>;
  getAttendeeSession(eventId: string, sessionId: string): Promise<AttendeeSession | undefined>;
  /** Every session of an event, newest heartbeat first: the Diagnose panel's one read for the roster. */
  listAttendeeSessions(eventId: string, limit?: number): Promise<AttendeeSession[]>;
  upsertAttendeeAgendaIntent(intent: AttendeeAgendaIntent): Promise<AttendeeAgendaIntent>;
  getAttendeeAgendaIntent(eventId: string, attendeeId: string): Promise<AttendeeAgendaIntent | undefined>;
  appendSponsorLeadOptIn(optIn: SponsorLeadOptIn): Promise<SponsorLeadOptIn>;
  upsertAttendeePermission(permission: AttendeePermission): Promise<AttendeePermission>;
  listAttendeePermissions(eventId: string, attendeeId: string): Promise<AttendeePermission[]>;
  appendRunOfShowEvent(event: V6RunOfShowRuntimeEvent): Promise<V6RunOfShowRuntimeEvent>;
  getStageStreamState(key: string): Promise<StageStreamState | undefined>;
  setStageStreamState(key: string, state: StageStreamState): Promise<StageStreamState>;
  appendStageStreamEvent(event: StageStreamEvent): Promise<StageStreamEvent>;
  /** Newest first, this event and stage only, capped: the fallback event log on the testing console. */
  listStageStreamEvents(eventId: string, stageId: string, limit: number): Promise<StageStreamEvent[]>;
  appendLiveChatMessage(message: LiveChatMessage): Promise<LiveChatMessage>;
  /** Attendee listing by default (hidden messages excluded); crew surfaces pass includeHidden. */
  listLiveChatMessages(eventId: string, roomKind: string, roomId: string, options?: { includeHidden?: boolean }): Promise<LiveChatMessage[]>;
  /** Newest first, every room of the event, hidden included: the crew moderation queue. */
  listRecentLiveChatMessages(eventId: string, limit: number): Promise<LiveChatMessage[]>;
  updateLiveChatMessageModeration(input: { id: string; eventId: string; moderationStatus: LiveChatMessage["moderationStatus"]; moderatedBy: string; moderatedAt: string }): Promise<LiveChatMessage | undefined>;
  /**
   * Delta poll: every row of the room created OR moderated OR archived since `since`, hidden and
   * archived included, so the caller can turn a hide or a clear into a removal for open pages.
   */
  listLiveChatMessagesSince(eventId: string, roomKind: string, roomId: string, since: string): Promise<LiveChatMessage[]>;
  /** Crew "Clear chat": archive every visible row of the room. Returns how many were archived. */
  archiveLiveChatRoomMessages(input: { eventId: string; roomKind: string; roomId: string; archivedAt: string; archivedBy: string }): Promise<number>;
  /** Per-person chat flood-guard row, keyed event:attendee. */
  getLiveChatRateState(key: string): Promise<LiveChatRateState | undefined>;
  setLiveChatRateState(state: LiveChatRateState): Promise<LiveChatRateState>;
  setLiveChatModerationState(state: LiveChatModerationState): Promise<LiveChatModerationState>;
  getLiveChatModerationState(key: string): Promise<LiveChatModerationState | undefined>;
  listLiveChatModerationStates(eventId: string): Promise<LiveChatModerationState[]>;
  setAttendeeLiveCapability(key: string, capability: AttendeeLiveCapability): Promise<AttendeeLiveCapability>;
  getAttendeeLiveCapability(key: string): Promise<AttendeeLiveCapability | undefined>;
  /** Every capability row of the event (all rooms): the roster's live status and the pending-request queue. */
  listAttendeeLiveCapabilities(eventId: string): Promise<AttendeeLiveCapability[]>;
  setAttendeeLiveControlState(key: string, state: AttendeeLiveControlState): Promise<AttendeeLiveControlState>;
  getAttendeeLiveControlState(key: string): Promise<AttendeeLiveControlState | undefined>;
  // Special guests (migration 0026): identity from the role code, and event-scoped guest state.
  upsertSpecialGuestProfile(profile: SpecialGuestProfile): Promise<SpecialGuestProfile>;
  getSpecialGuestProfile(eventId: string, guestId: string): Promise<SpecialGuestProfile | undefined>;
  listSpecialGuestProfiles(eventId: string, role?: SpecialGuestRole): Promise<SpecialGuestProfile[]>;
  setEventGuestState(record: EventGuestStateRecord): Promise<EventGuestStateRecord>;
  getEventGuestState(key: string): Promise<EventGuestStateRecord | undefined>;
  listEventGuestStates(eventId: string, kind?: string): Promise<EventGuestStateRecord[]>;
  // Speed networking (migration 0027): the queue and the 1:1 matches.
  upsertSpeedNetworkingEntry(entry: SpeedNetworkingQueueEntry): Promise<SpeedNetworkingQueueEntry>;
  getSpeedNetworkingEntry(eventId: string, attendeeId: string): Promise<SpeedNetworkingQueueEntry | undefined>;
  listSpeedNetworkingEntries(eventId: string): Promise<SpeedNetworkingQueueEntry[]>;
  upsertSpeedNetworkingMatch(match: SpeedNetworkingMatchRecord): Promise<SpeedNetworkingMatchRecord>;
  getSpeedNetworkingMatch(eventId: string, matchId: string): Promise<SpeedNetworkingMatchRecord | undefined>;
  /** Every match of the event (newest first): the active ones and the pair history behind no-repeat. */
  listSpeedNetworkingMatches(eventId: string): Promise<SpeedNetworkingMatchRecord[]>;
  readSnapshot(): Promise<V6RuntimeSnapshot>;
  // Runtime-created events, clients, and agency settings (migration 0024).
  upsertRuntimeEvent(event: RuntimeEventRecord): Promise<RuntimeEventRecord>;
  getRuntimeEvent(idOrSlugOrJoinCode: string): Promise<RuntimeEventRecord | undefined>;
  listRuntimeEvents(): Promise<RuntimeEventRecord[]>;
  upsertRuntimeClient(client: RuntimeClientRecord): Promise<RuntimeClientRecord>;
  listRuntimeClients(): Promise<RuntimeClientRecord[]>;
  getAgencySettings(id: string): Promise<AgencySettingsRecord | undefined>;
  setAgencySettings(settings: AgencySettingsRecord): Promise<AgencySettingsRecord>;
  // Event requests (migration 0036): the /request-event row, from arrival to paid.
  upsertEventRequest(request: EventRequestRecord): Promise<EventRequestRecord>;
  getEventRequest(id: string): Promise<EventRequestRecord | undefined>;
  /** The client's own link resolves by token alone; it carries no id a visitor could edit. */
  getEventRequestByConfirmToken(token: string): Promise<EventRequestRecord | undefined>;
  listEventRequests(limit?: number): Promise<EventRequestRecord[]>;
  // The five instruction pages (migration 0036), edited from the workspace, linked from every email.
  getHowItWorksPage(slug: HowItWorksAudience): Promise<HowItWorksPageRecord | undefined>;
  listHowItWorksPages(): Promise<HowItWorksPageRecord[]>;
  setHowItWorksPage(page: HowItWorksPageRecord): Promise<HowItWorksPageRecord>;
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
    liveChatRateStates: [],
    liveChatModerationStates: [],
    attendeeLiveCapabilities: [],
    attendeeLiveControlStates: [],
    specialGuestProfiles: [],
    eventGuestStates: [],
    speedNetworkingEntries: [],
    speedNetworkingMatches: [],
    contacts: [],
    eventAssets: [],
    suppliers: [],
    supplierEventLinks: [],
    emailSendLogs: [],
    eventTemplates: [],
    runtimeEvents: [],
    runtimeClients: [],
    agencySettings: [],
    eventRequests: [],
    howItWorksPages: [],
  };
}
