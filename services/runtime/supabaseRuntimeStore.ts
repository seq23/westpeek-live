import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditLog } from "@/types/core";
import type { V4AnalyticsEvent, V4RoomFallbackState } from "@/types/v4";
import type { StageStreamEvent, StageStreamState } from "@/types/stageStream";
import type { LiveChatMessage, LiveChatModerationState } from "@/types/liveChat";
import type { AttendeeLiveCapability, AttendeeLiveControlState } from "@/types/attendeeLive";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { AttendeeAgendaIntent, AttendeePermission, AttendeeSession, SponsorLeadOptIn } from "@/types/attendeeSession";
import { RuntimeSchemaMissingError, type AgencySettingsRecord, type RuntimeClientRecord, type RuntimeEventRecord } from "@/types/runtimeEvent";
import type { EventRequestRecord } from "@/types/eventRequest";
import type { HowItWorksAudience, HowItWorksPageRecord } from "@/types/howItWorks";
import type { EventGuestStateRecord, SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";
import type { SpeedNetworkingMatchRecord, SpeedNetworkingQueueEntry } from "@/types/speedNetworking";
import type { ContactRecord, RegistrationQuestion } from "@/types/attendeeRegistration";
import type { EventAssetRecord } from "@/types/eventAssets";
import type { SupplierEventLink, SupplierKind, SupplierRateKind, SupplierRecord, SupplierStatus } from "@/types/suppliers";
import type { EmailSendLog } from "@/types/emailProduction";
import { emptyRuntimeSnapshot, type RuntimeStore, type V5AccessAttemptRuntimeEvent, type V5FallbackRuntimeEvent, type V6EmailRuntimeEvent, type V6IncidentRuntimeEvent, type V6RegistrationRuntimeEvent, type V6RunOfShowRuntimeEvent, type V6RuntimeSnapshot, type V6SupportRequestRuntimeEvent } from "./runtimeStore";


function mapLiveChatMessage(row: Record<string, unknown>): LiveChatMessage {
  return {
    id: String(row.id),
    eventId: String(row.event_id || ""),
    roomKind: row.room_kind as LiveChatMessage["roomKind"],
    roomId: String(row.room_id || ""),
    attendeeId: row.attendee_id ? String(row.attendee_id) : undefined,
    displayName: String(row.display_name || "Attendee"),
    company: row.company ? String(row.company) : undefined,
    message: String(row.message || ""),
    moderationStatus: (row.moderation_status as LiveChatMessage["moderationStatus"]) || "visible",
    moderatedBy: row.moderated_by ? String(row.moderated_by) : undefined,
    moderatedAt: row.moderated_at ? String(row.moderated_at) : undefined,
    createdAt: String(row.created_at || ""),
  };
}

function mapSpecialGuestProfile(row: Record<string, unknown>): SpecialGuestProfile {
  return { guestId: String(row.guest_id), eventId: String(row.event_id), role: row.role as SpecialGuestRole, name: String(row.name || ""), company: String(row.company || ""), title: String(row.title || ""), createdAt: String(row.created_at || ""), updatedAt: String(row.updated_at || "") };
}

function mapSpeedNetworkingEntry(row: Record<string, unknown>): SpeedNetworkingQueueEntry {
  return { id: String(row.id), eventId: String(row.event_id), attendeeId: String(row.attendee_id), displayName: String(row.display_name || ""), company: String(row.company || ""), title: String(row.title || ""), status: row.status as SpeedNetworkingQueueEntry["status"], joinedAt: String(row.joined_at || ""), matchedAt: row.matched_at ? String(row.matched_at) : undefined, matchId: row.match_id ? String(row.match_id) : undefined, matchesCompleted: Number(row.matches_completed || 0), updatedAt: String(row.updated_at || "") };
}

function mapSpeedNetworkingMatch(row: Record<string, unknown>): SpeedNetworkingMatchRecord {
  return { id: String(row.id), eventId: String(row.event_id), attendeeAId: String(row.attendee_a_id), attendeeBId: String(row.attendee_b_id), normalizedPairKey: String(row.normalized_pair_key), roomName: String(row.room_name), status: row.status as SpeedNetworkingMatchRecord["status"], startsAt: String(row.starts_at || ""), expiresAt: String(row.expires_at || ""), endedAt: row.ended_at ? String(row.ended_at) : undefined, endedReason: row.ended_reason ? String(row.ended_reason) : undefined };
}

function mapContact(row: Record<string, unknown>): ContactRecord {
  return { email: String(row.email), name: String(row.name || ""), company: String(row.company || ""), title: String(row.title || ""), personalWebsite: row.personal_website ? String(row.personal_website) : undefined, socialLinks: Array.isArray(row.social_links) ? row.social_links.map(String) : [], topicsOfInterest: Array.isArray(row.topics_of_interest) ? row.topics_of_interest.map(String) : [], networkingGoals: row.networking_goals ? String(row.networking_goals) : undefined, hiddenFromDirectory: Boolean(row.hidden_from_directory), eventsAttended: Array.isArray(row.events_attended) ? row.events_attended.map(String) : [], archivedAt: row.archived_at ? String(row.archived_at) : undefined, firstSeenAt: String(row.first_seen_at || ""), lastSeenAt: String(row.last_seen_at || ""), updatedAt: String(row.updated_at || "") };
}

function mapEventGuestState(row: Record<string, unknown>): EventGuestStateRecord {
  return { key: String(row.key), eventId: String(row.event_id), kind: row.kind as EventGuestStateRecord["kind"], guestId: row.guest_id ? String(row.guest_id) : undefined, state: row.state, updatedAt: String(row.updated_at || "") };
}

function mapAttendeeProfile(row: Record<string, unknown>): AttendeeProfile {
  return { attendeeId: String(row.attendee_id || ""), eventId: String(row.event_id || ""), emailHash: String(row.email_hash || ""), email: row.email ? String(row.email) : undefined, extraAnswers: (row.extra_answers && typeof row.extra_answers === "object" ? (row.extra_answers as Record<string, string>) : {}), name: String(row.name || ""), emailMasked: row.email_masked ? String(row.email_masked) : undefined, company: String(row.company || ""), title: String(row.title || ""), personalWebsite: row.personal_website ? String(row.personal_website) : undefined, socialLinks: Array.isArray(row.social_links) ? row.social_links.map(String) : [], reasonForAttending: row.reason_for_attending ? String(row.reason_for_attending) : undefined, interestingFact: row.interesting_fact ? String(row.interesting_fact) : undefined, topicsOfInterest: Array.isArray(row.topics_of_interest) ? row.topics_of_interest.map(String) : [], networkingGoals: row.networking_goals ? String(row.networking_goals) : undefined, networkingOptIn: Boolean(row.networking_opt_in), hiddenFromDirectory: Boolean(row.hidden_from_directory), role: "attendee", status: (row.status as AttendeeProfile["status"]) || "active", createdAt: String(row.created_at || ""), updatedAt: String(row.updated_at || "") };
}

function mapEmailSendLog(row: Record<string, unknown>): EmailSendLog & { sentBy?: string } {
  return {
    id: String(row.id),
    eventId: row.event_id ? String(row.event_id) : undefined,
    agencyId: row.agency_id ? String(row.agency_id) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    workflowType: row.workflow_type as EmailSendLog["workflowType"],
    recipientEmail: String(row.recipient_email || ""),
    recipientName: row.recipient_name ? String(row.recipient_name) : undefined,
    subject: String(row.subject || ""),
    provider: (row.provider as EmailSendLog["provider"]) || "resend",
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
    status: (row.status as EmailSendLog["status"]) || "queued",
    actionUrl: row.action_url ? String(row.action_url) : undefined,
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    sentBy: row.sent_by ? String(row.sent_by) : undefined,
    queuedAt: String(row.queued_at || ""),
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    failedAt: row.failed_at ? String(row.failed_at) : undefined,
  };
}

function mapEventAsset(row: Record<string, unknown>): EventAssetRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_id || ""),
    fileName: String(row.file_name || ""),
    mimeType: String(row.mime_type || ""),
    sizeBytes: Number(row.size_bytes || 0),
    storagePath: row.storage_path ? String(row.storage_path) : undefined,
    externalUrl: row.external_url ? String(row.external_url) : undefined,
    uploadedByKind: (row.uploaded_by_kind as EventAssetRecord["uploadedByKind"]) || "operator",
    uploadedByLabel: String(row.uploaded_by_label || ""),
    visibility: (row.visibility as EventAssetRecord["visibility"]) || "internal",
    status: (row.status as EventAssetRecord["status"]) || "uploaded",
    note: row.note ? String(row.note) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    archivedAt: row.archived_at ? String(row.archived_at) : undefined,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapSupplier(row: Record<string, unknown>): SupplierRecord {
  return {
    id: String(row.id),
    kind: (row.kind as SupplierKind) || "contractor",
    name: String(row.name || ""),
    company: String(row.company || ""),
    roleOrService: String(row.role_or_service || ""),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    rateKind: (row.rate_kind as SupplierRateKind) || "day_rate",
    rateAmount: Number(row.rate_amount || 0),
    notes: String(row.notes || ""),
    status: (row.status as SupplierStatus) || "shortlisted",
    archivedAt: row.archived_at ? String(row.archived_at) : undefined,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapSupplierEventLink(row: Record<string, unknown>): SupplierEventLink {
  return { id: String(row.id), supplierId: String(row.supplier_id), eventId: String(row.event_id), note: String(row.note || ""), createdAt: String(row.created_at || "") };
}

function mapAttendeeSession(row: Record<string, unknown>): AttendeeSession {
  return { sessionId: String(row.session_id || ""), attendeeId: String(row.attendee_id || ""), eventId: String(row.event_id || ""), role: "attendee", status: (row.status as AttendeeSession["status"]) || "active", issuedAt: String(row.issued_at || ""), expiresAt: String(row.expires_at || ""), lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : undefined };
}

function mapAttendeeAgendaIntent(row: Record<string, unknown>): AttendeeAgendaIntent {
  return { id: String(row.id || ""), attendeeId: String(row.attendee_id || ""), eventId: String(row.event_id || ""), plannedSessionIds: Array.isArray(row.planned_session_ids) ? row.planned_session_ids.map(String) : [], plannedBreakoutIds: Array.isArray(row.planned_breakout_ids) ? row.planned_breakout_ids.map(String) : [], plannedSponsorBoothIds: Array.isArray(row.planned_sponsor_booth_ids) ? row.planned_sponsor_booth_ids.map(String) : [], wantsSessionReminders: Boolean(row.wants_session_reminders), updatedAt: String(row.updated_at || "") };
}

function fail(message: string): never {
  throw new Error(`Supabase runtime store failed: ${message}`);
}

async function insertRecord<T>(client: SupabaseClient, table: string, payload: Record<string, unknown>, original: T): Promise<T> {
  const { error } = await client.from(table).insert(payload);
  if (error) fail(`${table}: ${error.message}`);
  return original;
}

async function selectAll<T>(client: SupabaseClient, table: string, columns = "*", orderColumn = "created_at"): Promise<T[]> {
  const query = client.from(table).select(columns).order(orderColumn, { ascending: true });
  const { data, error } = await query;
  if (error) fail(`${table} read: ${error.message}`);
  return (data || []) as T[];
}


type PostgrestErrorLike = { code?: string; message: string };

/** PostgREST reports an unmigrated table as PGRST205 (schema cache) or 42P01 (undefined_table). */
function isMissingTableError(error: PostgrestErrorLike) {
  return error.code === "PGRST205" || error.code === "42P01" || /schema cache|does not exist/i.test(error.message);
}

/** Diagnostic snapshot reads only: an unapplied migration must not take the testing console down. */
function tolerateMissingTable(error: unknown) {
  if (error instanceof Error && isMissingTableError({ message: error.message })) return [] as Record<string, unknown>[];
  throw error;
}

function failOrSchemaMissing(table: string, error: PostgrestErrorLike): never {
  if (isMissingTableError(error)) throw new RuntimeSchemaMissingError(table, error.message);
  fail(`${table}: ${error.message}`);
}

/**
 * The /request-event row, all the way from arrival to paid. Nulls become undefined so a caller
 * never has to distinguish "column is null" from "field was not set".
 */
function mapEventRequest(row: Record<string, unknown>): EventRequestRecord {
  const text = (key: string) => (row[key] ? String(row[key]) : undefined);
  return {
    id: String(row.id),
    name: String(row.name || ""),
    email: String(row.email || ""),
    company: text("company"),
    eventType: text("event_type"),
    eventDate: text("event_date"),
    audienceSize: text("audience_size"),
    livestreamNeeds: text("livestream_needs"),
    networkingNeeds: text("networking_needs"),
    sponsorExpoNeeds: text("sponsor_expo_needs"),
    speakerCount: text("speaker_count"),
    supportLevel: text("support_level"),
    notes: text("notes"),
    budgetRange: text("budget_range"),
    state: (row.state as EventRequestRecord["state"]) || "requested",
    scopeSummary: text("scope_summary"),
    priceAmountCents: row.price_amount_cents === null || row.price_amount_cents === undefined ? undefined : Number(row.price_amount_cents),
    priceCurrency: text("price_currency"),
    confirmToken: text("confirm_token"),
    eventId: text("event_id"),
    approvedAt: text("approved_at"),
    approvedBy: text("approved_by"),
    confirmedAt: text("confirmed_at"),
    paidAt: text("paid_at"),
    paidBy: text("paid_by"),
    settlementMethod: row.settlement_method ? (String(row.settlement_method) as EventRequestRecord["settlementMethod"]) : undefined,
    settlementReference: text("settlement_reference"),
    instructionsSentAt: text("instructions_sent_at"),
    declinedAt: text("declined_at"),
    declineReason: text("decline_reason"),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || row.created_at || ""),
  };
}

function eventRequestToRow(request: EventRequestRecord) {
  return {
    id: request.id,
    name: request.name,
    email: request.email,
    company: request.company ?? null,
    event_type: request.eventType ?? null,
    event_date: request.eventDate ?? null,
    audience_size: request.audienceSize ?? null,
    livestream_needs: request.livestreamNeeds ?? null,
    networking_needs: request.networkingNeeds ?? null,
    sponsor_expo_needs: request.sponsorExpoNeeds ?? null,
    speaker_count: request.speakerCount ?? null,
    support_level: request.supportLevel ?? null,
    notes: request.notes ?? null,
    budget_range: request.budgetRange ?? null,
    state: request.state,
    scope_summary: request.scopeSummary ?? null,
    price_amount_cents: request.priceAmountCents ?? null,
    price_currency: request.priceCurrency ?? null,
    confirm_token: request.confirmToken ?? null,
    event_id: request.eventId ?? null,
    approved_at: request.approvedAt ?? null,
    approved_by: request.approvedBy ?? null,
    confirmed_at: request.confirmedAt ?? null,
    paid_at: request.paidAt ?? null,
    paid_by: request.paidBy ?? null,
    settlement_method: request.settlementMethod ?? null,
    settlement_reference: request.settlementReference ?? null,
    instructions_sent_at: request.instructionsSentAt ?? null,
    declined_at: request.declinedAt ?? null,
    decline_reason: request.declineReason ?? null,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
  };
}

function mapHowItWorksPage(row: Record<string, unknown>): HowItWorksPageRecord {
  return {
    slug: row.slug as HowItWorksPageRecord["slug"],
    title: String(row.title || ""),
    intro: String(row.intro || ""),
    body: String(row.body || ""),
    updatedBy: String(row.updated_by || ""),
    updatedByLabel: String(row.updated_by_label || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function runtimeEventToRow(event: RuntimeEventRecord) {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    format: event.format,
    event_type: event.eventType,
    status: event.status,
    status_before_archive: event.statusBeforeArchive ?? null,
    client_id: event.clientId ?? null,
    client_name: event.clientName,
    client_slug: event.clientSlug,
    description: event.description ?? null,
    start_at: event.startAt,
    end_at: event.endAt,
    timezone: event.timezone,
    join_code: event.joinCode,
    crew_code: event.accessCodes.crew,
    speaker_code: event.accessCodes.speaker,
    sponsor_code: event.accessCodes.sponsor,
    vip_code: event.accessCodes.vip,
    client_code: event.accessCodes.client,
    registration_enabled: event.registrationEnabled,
    registration_questions: event.registrationQuestions ?? null,
    branding: event.branding,
    sessions: event.sessions,
    source: event.source === "seed" ? "runtime" : event.source,
    created_by: event.createdBy,
    created_by_label: event.createdByLabel,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
    archived_at: event.archivedAt ?? null,
  };
}

function rowToRuntimeEvent(row: Record<string, unknown>): RuntimeEventRecord {
  return {
    id: String(row.id),
    slug: String(row.slug || row.id),
    name: String(row.name || ""),
    format: (row.format as RuntimeEventRecord["format"]) || "stage",
    eventType: String(row.event_type || "webinar"),
    status: (row.status as RuntimeEventRecord["status"]) || "draft",
    statusBeforeArchive: row.status_before_archive ? (row.status_before_archive as RuntimeEventRecord["status"]) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    clientName: String(row.client_name || "West Peek"),
    clientSlug: String(row.client_slug || "west-peek"),
    description: row.description ? String(row.description) : undefined,
    startAt: String(row.start_at || ""),
    endAt: String(row.end_at || ""),
    timezone: String(row.timezone || "America/Chicago"),
    joinCode: String(row.join_code || ""),
    accessCodes: {
      crew: String(row.crew_code || ""),
      speaker: String(row.speaker_code || ""),
      sponsor: String(row.sponsor_code || ""),
      vip: String(row.vip_code || ""),
      client: String(row.client_code || ""),
    },
    registrationEnabled: Boolean(row.registration_enabled),
    registrationQuestions: Array.isArray(row.registration_questions) ? (row.registration_questions as RegistrationQuestion[]) : undefined,
    branding: (row.branding && typeof row.branding === "object" ? row.branding : {}) as RuntimeEventRecord["branding"],
    sessions: Array.isArray(row.sessions) ? (row.sessions as RuntimeEventRecord["sessions"]) : [],
    source: (row.source as RuntimeEventRecord["source"]) || "runtime",
    createdBy: String(row.created_by || ""),
    createdByLabel: String(row.created_by_label || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
    archivedAt: row.archived_at ? String(row.archived_at) : undefined,
  };
}

function runtimeClientToRow(client: RuntimeClientRecord) {
  return {
    id: client.id,
    slug: client.slug,
    name: client.name,
    industry: client.industry ?? null,
    primary_contact_name: client.primaryContactName ?? null,
    primary_contact_email: client.primaryContactEmail ?? null,
    status: client.status,
    created_by: client.createdBy,
    created_by_label: client.createdByLabel,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
  };
}

function rowToRuntimeClient(row: Record<string, unknown>): RuntimeClientRecord {
  return {
    id: String(row.id),
    slug: String(row.slug || row.id),
    name: String(row.name || ""),
    industry: row.industry ? String(row.industry) : undefined,
    primaryContactName: row.primary_contact_name ? String(row.primary_contact_name) : undefined,
    primaryContactEmail: row.primary_contact_email ? String(row.primary_contact_email) : undefined,
    status: (row.status as RuntimeClientRecord["status"]) || "active",
    createdBy: String(row.created_by || ""),
    createdByLabel: String(row.created_by_label || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function rowToAgencySettings(row: Record<string, unknown>): AgencySettingsRecord {
  return {
    id: String(row.id),
    agencyName: String(row.agency_name || ""),
    primaryColor: String(row.primary_color || ""),
    accentColor: String(row.accent_color || ""),
    members: Array.isArray(row.members) ? (row.members as AgencySettingsRecord["members"]) : [],
    updatedBy: String(row.updated_by || ""),
    updatedByLabel: String(row.updated_by_label || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export class SupabaseRuntimeStore implements RuntimeStore {
  readonly kind = "supabase" as const;
  private readonly client: SupabaseClient;

  constructor(client = createSupabaseAdminClient()) {
    this.client = client;
  }

  appendAuditLog(log: AuditLog) {
    return insertRecord(this.client, "audit_logs", {
      id: log.id,
      agency_id: log.agencyId,
      client_id: log.clientId,
      event_id: log.eventId,
      actor_user_id: log.actorUserId,
      actor_role: log.actorRole,
      action: log.action,
      resource_type: log.resourceType,
      resource_id: log.resourceId,
      visibility: log.visibility,
      created_at: log.createdAt,
    }, log);
  }

  appendAccessAttempt(event: V5AccessAttemptRuntimeEvent) {
    return insertRecord(this.client, "v5_access_attempt_events", {
      id: event.id,
      status: event.status,
      access_kind: event.accessKind,
      event_id: event.eventId,
      role: event.role,
      route: event.route,
      reason: event.reason,
      ip_hash: event.ipHash,
      user_agent_hash: event.userAgentHash,
      created_at: event.createdAt,
    }, event);
  }

  appendAnalyticsEvent(event: V4AnalyticsEvent) {
    return insertRecord(this.client, "v5_analytics_events", {
      id: event.id,
      event_id: event.eventId,
      kind: event.kind,
      subject_id: event.subjectId,
      metadata: event.metadata || {},
      created_at: event.createdAt,
    }, event);
  }

  appendFallbackEvent(event: V5FallbackRuntimeEvent) {
    return insertRecord(this.client, "v5_runtime_fallback_events", {
      id: event.id,
      event_id: event.eventId,
      room_id: event.roomId,
      room_type: event.roomType,
      provider: event.provider,
      action: event.action,
      actor_role: event.actorRole,
      reason: event.reason,
      created_at: event.createdAt,
    }, event);
  }

  async getFallbackState(key: string) {
    const [eventId, roomType] = key.split(":");
    const { data, error } = await this.client
      .from("v6_room_fallback_states")
      .select("state")
      .eq("event_id", eventId)
      .eq("room_type", roomType)
      .maybeSingle();
    if (error) fail(`v6_room_fallback_states read: ${error.message}`);
    return data?.state as V4RoomFallbackState | undefined;
  }

  async setFallbackState(key: string, state: V4RoomFallbackState) {
    const [eventId, roomType] = key.split(":");
    const { error } = await this.client.from("v6_room_fallback_states").upsert({
      event_id: eventId,
      room_type: roomType,
      state,
      updated_at: new Date().toISOString(),
    });
    if (error) fail(`v6_room_fallback_states upsert: ${error.message}`);
    return state;
  }

  appendIncident(event: V6IncidentRuntimeEvent) {
    return insertRecord(this.client, "v6_incident_events", {
      id: event.id,
      event_id: event.eventId,
      title: event.title,
      severity: event.severity,
      status: event.status,
      owner_role: event.ownerRole,
      details: event.details,
      created_at: event.createdAt,
    }, event);
  }

  appendSupportRequest(event: V6SupportRequestRuntimeEvent) {
    return insertRecord(this.client, "v6_support_requests", {
      id: event.id,
      event_id: event.eventId,
      attendee_id: event.attendeeId,
      subject: event.subject,
      status: event.status,
      created_at: event.createdAt,
    }, event);
  }

  appendEmailEvent(event: V6EmailRuntimeEvent) {
    return insertRecord(this.client, "v6_email_events", {
      id: event.id,
      event_id: event.eventId,
      template_key: event.templateKey,
      recipient_segment: event.recipientSegment,
      status: event.status,
      provider_message_id: event.providerMessageId,
      reason: event.reason,
      created_at: event.createdAt,
    }, event);
  }

  appendRegistration(event: V6RegistrationRuntimeEvent) {
    return insertRecord(this.client, "v6_registration_events", {
      id: event.id,
      event_id: event.eventId,
      attendee_email_hash: event.attendeeEmailHash,
      status: event.status,
      display_name: event.displayName,
      company: event.company,
      title: event.title,
      personal_website: event.personalWebsite,
      social_links: event.socialLinks || [],
      reason_for_attending: event.reasonForAttending,
      interesting_fact: event.interestingFact,
      created_at: event.createdAt,
    }, event);
  }


  async upsertAttendeeProfile(profile: AttendeeProfile) {
    const { error } = await this.client.from("attendee_profiles").upsert({
      attendee_id: profile.attendeeId, event_id: profile.eventId, email_hash: profile.emailHash, email: profile.email ?? null, extra_answers: profile.extraAnswers || {}, name: profile.name, email_masked: profile.emailMasked, company: profile.company, title: profile.title, personal_website: profile.personalWebsite, social_links: profile.socialLinks || [], reason_for_attending: profile.reasonForAttending, interesting_fact: profile.interestingFact, topics_of_interest: profile.topicsOfInterest || [], networking_goals: profile.networkingGoals, networking_opt_in: profile.networkingOptIn, hidden_from_directory: Boolean(profile.hiddenFromDirectory), role: profile.role, status: profile.status, created_at: profile.createdAt, updated_at: profile.updatedAt,
    });
    if (error) fail(`attendee_profiles upsert: ${error.message}`);
    return profile;
  }

  async getAttendeeProfile(eventId: string, attendeeId: string) {
    const { data, error } = await this.client.from("attendee_profiles").select("*").eq("event_id", eventId).eq("attendee_id", attendeeId).maybeSingle();
    if (error) fail(`attendee_profiles read: ${error.message}`);
    return data ? mapAttendeeProfile(data as Record<string, unknown>) : undefined;
  }

  async getAttendeeProfileByEmailHash(eventId: string, emailHash: string) {
    const { data, error } = await this.client.from("attendee_profiles").select("*").eq("event_id", eventId).eq("email_hash", emailHash).maybeSingle();
    if (error) fail(`attendee_profiles email read: ${error.message}`);
    return data ? mapAttendeeProfile(data as Record<string, unknown>) : undefined;
  }

  async listAttendeeProfiles(eventId: string, limit = 100) {
    const { data, error } = await this.client.from("attendee_profiles").select("*").eq("event_id", eventId).eq("status", "active").order("updated_at", { ascending: false }).limit(limit);
    if (error) fail(`attendee_profiles list: ${error.message}`);
    return (data || []).map((row) => mapAttendeeProfile(row as Record<string, unknown>));
  }

  async listAttendeeProfilesByEmailHash(emailHash: string) {
    const { data, error } = await this.client.from("attendee_profiles").select("*").eq("email_hash", emailHash).limit(500);
    if (error) fail(`attendee_profiles hash list: ${error.message}`);
    return (data || []).map((row) => mapAttendeeProfile(row as Record<string, unknown>));
  }

  async listAttendeeProfilesWithoutEmail(limit = 5000) {
    const { data, error } = await this.client.from("attendee_profiles").select("*").is("email", null).eq("status", "active").order("created_at", { ascending: true }).limit(limit);
    if (error) fail(`attendee_profiles no-email list: ${error.message}`);
    return (data || []).map((row) => mapAttendeeProfile(row as Record<string, unknown>));
  }

  async upsertAttendeeSession(session: AttendeeSession) {
    const { error } = await this.client.from("attendee_sessions").upsert({ session_id: session.sessionId, attendee_id: session.attendeeId, event_id: session.eventId, role: session.role, status: session.status, issued_at: session.issuedAt, expires_at: session.expiresAt, last_seen_at: session.lastSeenAt });
    if (error) fail(`attendee_sessions upsert: ${error.message}`);
    return session;
  }

  async getAttendeeSession(eventId: string, sessionId: string) {
    const { data, error } = await this.client.from("attendee_sessions").select("*").eq("event_id", eventId).eq("session_id", sessionId).maybeSingle();
    if (error) fail(`attendee_sessions read: ${error.message}`);
    return data ? mapAttendeeSession(data as Record<string, unknown>) : undefined;
  }

  async upsertAttendeeAgendaIntent(intent: AttendeeAgendaIntent) {
    const { error } = await this.client.from("attendee_agenda_intents").upsert({ id: intent.id, attendee_id: intent.attendeeId, event_id: intent.eventId, planned_session_ids: intent.plannedSessionIds, planned_breakout_ids: intent.plannedBreakoutIds, planned_sponsor_booth_ids: intent.plannedSponsorBoothIds, wants_session_reminders: intent.wantsSessionReminders, updated_at: intent.updatedAt });
    if (error) fail(`attendee_agenda_intents upsert: ${error.message}`);
    return intent;
  }

  async getAttendeeAgendaIntent(eventId: string, attendeeId: string) {
    const { data, error } = await this.client.from("attendee_agenda_intents").select("*").eq("event_id", eventId).eq("attendee_id", attendeeId).maybeSingle();
    if (error) fail(`attendee_agenda_intents read: ${error.message}`);
    return data ? mapAttendeeAgendaIntent(data as Record<string, unknown>) : undefined;
  }

  async appendSponsorLeadOptIn(optIn: SponsorLeadOptIn) {
    return insertRecord(this.client, "sponsor_lead_opt_ins", { id: optIn.id, attendee_id: optIn.attendeeId, event_id: optIn.eventId, sponsor_booth_id: optIn.sponsorBoothId, allowed_fields: optIn.allowedFields, created_at: optIn.createdAt }, optIn);
  }



  async upsertAttendeePermission(permission: AttendeePermission) {
    const { error } = await this.client.from("attendee_permissions").upsert({ id: permission.id, attendee_id: permission.attendeeId, event_id: permission.eventId, permission_kind: permission.permissionKind, granted: permission.granted, granted_by: permission.grantedBy, reason: permission.reason, updated_at: permission.updatedAt });
    if (error) fail(`attendee_permissions upsert: ${error.message}`);
    return permission;
  }

  async listAttendeePermissions(eventId: string, attendeeId: string) {
    const { data, error } = await this.client.from("attendee_permissions").select("*").eq("event_id", eventId).eq("attendee_id", attendeeId);
    if (error) fail(`attendee_permissions list: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({ id: String(row.id || ""), attendeeId: String(row.attendee_id || ""), eventId: String(row.event_id || ""), permissionKind: row.permission_kind as AttendeePermission["permissionKind"], granted: Boolean(row.granted), grantedBy: row.granted_by ? String(row.granted_by) : undefined, reason: row.reason ? String(row.reason) : undefined, updatedAt: String(row.updated_at || "") }));
  }

  appendRunOfShowEvent(event: V6RunOfShowRuntimeEvent) {
    return insertRecord(this.client, "v6_run_of_show_runtime_events", {
      id: event.id,
      event_id: event.eventId,
      segment_id: event.segmentId,
      action: event.action,
      actor_role: event.actorRole,
      created_at: event.createdAt,
    }, event);
  }



  async getStageStreamState(key: string) {
    const [eventId, stageId] = key.split(":");
    const { data, error } = await this.client.from("stage_stream_states").select("state").eq("event_id", eventId).eq("stage_id", stageId).maybeSingle();
    if (error) fail(`stage_stream_states read: ${error.message}`);
    return data?.state as StageStreamState | undefined;
  }

  async setStageStreamState(key: string, state: StageStreamState) {
    const [eventId, stageId] = key.split(":");
    const { error } = await this.client.from("stage_stream_states").upsert({ event_id: eventId, stage_id: stageId, state, updated_at: new Date().toISOString() });
    if (error) fail(`stage_stream_states upsert: ${error.message}`);
    return state;
  }

  appendStageStreamEvent(event: StageStreamEvent) {
    return insertRecord(this.client, "stage_stream_events", { id: event.id, event_id: event.eventId, stage_id: event.stageId, signal: event.signal, state_event: event, created_at: event.createdAt }, event);
  }

  /**
   * Filtered at the database. The console used to read the whole table through readSnapshot(),
   * which PostgREST caps at its max-rows default (1000) oldest-first — a runtime event created after
   * the seed demos had filled the table never made the page. 16 Sep 2026.
   */
  async listStageStreamEvents(eventId: string, stageId: string, limit: number) {
    const { data, error } = await this.client.from("stage_stream_events").select("state_event").eq("event_id", eventId).eq("stage_id", stageId).order("created_at", { ascending: false }).limit(Math.max(1, limit));
    if (error) fail(`stage_stream_events read: ${error.message}`);
    return ((data || []) as Record<string, unknown>[]).map((row) => row.state_event as StageStreamEvent).filter(Boolean);
  }

  appendLiveChatMessage(message: LiveChatMessage) {
    return insertRecord(this.client, "live_chat_messages", { id: message.id, event_id: message.eventId, room_kind: message.roomKind, room_id: message.roomId, attendee_id: message.attendeeId, display_name: message.displayName, company: message.company, message: message.message, moderation_status: message.moderationStatus, created_at: message.createdAt }, message);
  }

  async listLiveChatMessages(eventId: string, roomKind: string, roomId: string, options?: { includeHidden?: boolean }) {
    let query = this.client.from("live_chat_messages").select("*").eq("event_id", eventId).eq("room_kind", roomKind).eq("room_id", roomId);
    if (!options?.includeHidden) query = query.neq("moderation_status", "hidden");
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) fail(`live_chat_messages read: ${error.message}`);
    return ((data || []) as Record<string, unknown>[]).map(mapLiveChatMessage);
  }

  async listRecentLiveChatMessages(eventId: string, limit: number) {
    const { data, error } = await this.client.from("live_chat_messages").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(Math.max(1, limit));
    if (error) fail(`live_chat_messages recent read: ${error.message}`);
    return ((data || []) as Record<string, unknown>[]).map(mapLiveChatMessage);
  }

  async updateLiveChatMessageModeration(input: { id: string; eventId: string; moderationStatus: LiveChatMessage["moderationStatus"]; moderatedBy: string; moderatedAt: string }) {
    const { data, error } = await this.client.from("live_chat_messages").update({ moderation_status: input.moderationStatus, moderated_by: input.moderatedBy, moderated_at: input.moderatedAt }).eq("id", input.id).eq("event_id", input.eventId).select("*").maybeSingle();
    if (error) failOrSchemaMissing("live_chat_messages.moderated_by", error);
    return data ? mapLiveChatMessage(data as Record<string, unknown>) : undefined;
  }

  async setLiveChatModerationState(state: LiveChatModerationState) {
    const { error } = await this.client.from("live_chat_moderation_states").upsert({ key: state.key, event_id: state.eventId, room_kind: state.roomKind, room_id: state.roomId, scope: state.scope, attendee_id: state.attendeeId ?? null, state, updated_at: state.updatedAt }, { onConflict: "key" });
    if (error) failOrSchemaMissing("live_chat_moderation_states", error);
    return state;
  }

  async getLiveChatModerationState(key: string) {
    const { data, error } = await this.client.from("live_chat_moderation_states").select("state").eq("key", key).maybeSingle();
    if (error) failOrSchemaMissing("live_chat_moderation_states", error);
    return data?.state as LiveChatModerationState | undefined;
  }

  async listLiveChatModerationStates(eventId: string) {
    const { data, error } = await this.client.from("live_chat_moderation_states").select("state").eq("event_id", eventId);
    if (error) failOrSchemaMissing("live_chat_moderation_states", error);
    return ((data || []) as Record<string, unknown>[]).map((row) => row.state as LiveChatModerationState).filter(Boolean);
  }

  async setAttendeeLiveCapability(key: string, capability: AttendeeLiveCapability) {
    const { error } = await this.client.from("attendee_live_capabilities").upsert({ key, event_id: capability.eventId, room_kind: capability.roomKind, room_id: capability.roomId, attendee_id: capability.attendeeId, capability, updated_at: capability.updatedAt });
    if (error) fail(`attendee_live_capabilities upsert: ${error.message}`);
    return capability;
  }

  async getAttendeeLiveCapability(key: string) {
    const { data, error } = await this.client.from("attendee_live_capabilities").select("capability").eq("key", key).maybeSingle();
    if (error) fail(`attendee_live_capabilities read: ${error.message}`);
    return data?.capability as AttendeeLiveCapability | undefined;
  }

  async listAttendeeLiveCapabilities(eventId: string) {
    const { data, error } = await this.client.from("attendee_live_capabilities").select("capability").eq("event_id", eventId).order("updated_at", { ascending: false });
    if (error) fail(`attendee_live_capabilities list: ${error.message}`);
    return ((data || []) as Record<string, unknown>[]).map((row) => row.capability as AttendeeLiveCapability).filter(Boolean);
  }

  async setAttendeeLiveControlState(key: string, state: AttendeeLiveControlState) {
    const { error } = await this.client.from("attendee_live_control_states").upsert({ key, event_id: state.eventId, room_kind: state.roomKind, room_id: state.roomId, state, updated_at: state.updatedAt });
    if (error) fail(`attendee_live_control_states upsert: ${error.message}`);
    return state;
  }

  async getAttendeeLiveControlState(key: string) {
    const { data, error } = await this.client.from("attendee_live_control_states").select("state").eq("key", key).maybeSingle();
    if (error) fail(`attendee_live_control_states read: ${error.message}`);
    return data?.state as AttendeeLiveControlState | undefined;
  }

  async upsertSpecialGuestProfile(profile: SpecialGuestProfile) {
    const { error } = await this.client.from("special_guest_profiles").upsert({ guest_id: profile.guestId, event_id: profile.eventId, role: profile.role, name: profile.name, company: profile.company, title: profile.title, created_at: profile.createdAt, updated_at: profile.updatedAt }, { onConflict: "event_id,guest_id" });
    if (error) failOrSchemaMissing("special_guest_profiles", error);
    return profile;
  }

  async getSpecialGuestProfile(eventId: string, guestId: string) {
    const { data, error } = await this.client.from("special_guest_profiles").select("*").eq("event_id", eventId).eq("guest_id", guestId).maybeSingle();
    if (error) failOrSchemaMissing("special_guest_profiles", error);
    return data ? mapSpecialGuestProfile(data as Record<string, unknown>) : undefined;
  }

  async listSpecialGuestProfiles(eventId: string, role?: SpecialGuestRole) {
    let query = this.client.from("special_guest_profiles").select("*").eq("event_id", eventId);
    if (role) query = query.eq("role", role);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) failOrSchemaMissing("special_guest_profiles", error);
    return ((data || []) as Record<string, unknown>[]).map(mapSpecialGuestProfile);
  }

  async setEventGuestState(record: EventGuestStateRecord) {
    const { error } = await this.client.from("event_guest_states").upsert({ key: record.key, event_id: record.eventId, kind: record.kind, guest_id: record.guestId ?? null, state: record.state, updated_at: record.updatedAt }, { onConflict: "key" });
    if (error) failOrSchemaMissing("event_guest_states", error);
    return record;
  }

  async getEventGuestState(key: string) {
    const { data, error } = await this.client.from("event_guest_states").select("*").eq("key", key).maybeSingle();
    if (error) failOrSchemaMissing("event_guest_states", error);
    return data ? mapEventGuestState(data as Record<string, unknown>) : undefined;
  }

  async listEventGuestStates(eventId: string, kind?: string) {
    let query = this.client.from("event_guest_states").select("*").eq("event_id", eventId);
    if (kind) query = query.eq("kind", kind);
    const { data, error } = await query;
    if (error) failOrSchemaMissing("event_guest_states", error);
    return ((data || []) as Record<string, unknown>[]).map(mapEventGuestState);
  }

  async upsertContact(contact: ContactRecord) {
    const { error } = await this.client.from("contacts").upsert({ email: contact.email, name: contact.name, company: contact.company, title: contact.title, personal_website: contact.personalWebsite ?? null, social_links: contact.socialLinks, topics_of_interest: contact.topicsOfInterest, networking_goals: contact.networkingGoals ?? null, hidden_from_directory: contact.hiddenFromDirectory, events_attended: contact.eventsAttended, archived_at: contact.archivedAt ?? null, first_seen_at: contact.firstSeenAt, last_seen_at: contact.lastSeenAt, updated_at: contact.updatedAt }, { onConflict: "email" });
    if (error) failOrSchemaMissing("contacts", error);
    return contact;
  }

  async getContact(email: string) {
    const { data, error } = await this.client.from("contacts").select("*").eq("email", email).maybeSingle();
    if (error) failOrSchemaMissing("contacts", error);
    return data ? mapContact(data as Record<string, unknown>) : undefined;
  }

  async listContacts() {
    const { data, error } = await this.client.from("contacts").select("*").order("last_seen_at", { ascending: false }).limit(5000);
    if (error) failOrSchemaMissing("contacts", error);
    return ((data || []) as Record<string, unknown>[]).map(mapContact);
  }

  async upsertEventAsset(asset: EventAssetRecord) {
    const { error } = await this.client.from("event_assets").upsert({
      id: asset.id, event_id: asset.eventId, file_name: asset.fileName, mime_type: asset.mimeType, size_bytes: asset.sizeBytes,
      storage_path: asset.storagePath ?? null, external_url: asset.externalUrl ?? null, uploaded_by_kind: asset.uploadedByKind,
      uploaded_by_label: asset.uploadedByLabel, visibility: asset.visibility, status: asset.status, note: asset.note ?? null,
      reviewed_by: asset.reviewedBy ?? null, reviewed_at: asset.reviewedAt ?? null, archived_at: asset.archivedAt ?? null,
      created_at: asset.createdAt, updated_at: asset.updatedAt,
    }, { onConflict: "id" });
    if (error) failOrSchemaMissing("event_assets", error);
    return asset;
  }

  async getEventAsset(id: string) {
    const { data, error } = await this.client.from("event_assets").select("*").eq("id", id).maybeSingle();
    if (error) failOrSchemaMissing("event_assets", error);
    return data ? mapEventAsset(data as Record<string, unknown>) : undefined;
  }

  async listEventAssets(eventId: string, includeArchived = false) {
    let query = this.client.from("event_assets").select("*").eq("event_id", eventId);
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
    if (error) failOrSchemaMissing("event_assets", error);
    return ((data || []) as Record<string, unknown>[]).map(mapEventAsset);
  }

  async listAllEventAssets(includeArchived = false) {
    let query = this.client.from("event_assets").select("*");
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(2000);
    if (error) failOrSchemaMissing("event_assets", error);
    return ((data || []) as Record<string, unknown>[]).map(mapEventAsset);
  }

  async upsertSupplier(supplier: SupplierRecord) {
    const { error } = await this.client.from("suppliers").upsert({
      id: supplier.id, kind: supplier.kind, name: supplier.name, company: supplier.company, role_or_service: supplier.roleOrService,
      email: supplier.email, phone: supplier.phone, rate_kind: supplier.rateKind, rate_amount: supplier.rateAmount,
      notes: supplier.notes, status: supplier.status, archived_at: supplier.archivedAt ?? null,
      created_at: supplier.createdAt, updated_at: supplier.updatedAt,
    }, { onConflict: "id" });
    if (error) failOrSchemaMissing("suppliers", error);
    return supplier;
  }

  async getSupplier(id: string) {
    const { data, error } = await this.client.from("suppliers").select("*").eq("id", id).maybeSingle();
    if (error) failOrSchemaMissing("suppliers", error);
    return data ? mapSupplier(data as Record<string, unknown>) : undefined;
  }

  async listSuppliers(includeArchived = false) {
    let query = this.client.from("suppliers").select("*");
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(2000);
    if (error) failOrSchemaMissing("suppliers", error);
    return ((data || []) as Record<string, unknown>[]).map(mapSupplier);
  }

  async upsertSupplierEventLink(link: SupplierEventLink) {
    // supplier_id + event_id is unique in 0033: attaching twice updates the one attachment.
    const { error } = await this.client.from("supplier_event_links").upsert({
      id: link.id, supplier_id: link.supplierId, event_id: link.eventId, note: link.note, created_at: link.createdAt,
    }, { onConflict: "supplier_id,event_id" });
    if (error) failOrSchemaMissing("supplier_event_links", error);
    return link;
  }

  /** Detach really removes the link row: the supplier and its other events are untouched. */
  async deleteSupplierEventLink(supplierId: string, eventId: string) {
    const { error } = await this.client.from("supplier_event_links").delete().eq("supplier_id", supplierId).eq("event_id", eventId);
    if (error) failOrSchemaMissing("supplier_event_links", error);
  }

  async listSupplierEventLinks() {
    const { data, error } = await this.client.from("supplier_event_links").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) failOrSchemaMissing("supplier_event_links", error);
    return ((data || []) as Record<string, unknown>[]).map(mapSupplierEventLink);
  }

  async appendEmailSendLog(log: EmailSendLog & { sentBy?: string }) {
    const { error } = await this.client.from("runtime_email_sends").upsert({
      id: log.id, event_id: log.eventId ?? null, agency_id: log.agencyId ?? null, client_id: log.clientId ?? null,
      workflow_type: log.workflowType, recipient_email: log.recipientEmail, recipient_name: log.recipientName ?? null,
      subject: log.subject, provider: log.provider, provider_message_id: log.providerMessageId ?? null, status: log.status,
      action_url: log.actionUrl ?? null, failure_reason: log.failureReason ?? null, sent_by: log.sentBy ?? null,
      queued_at: log.queuedAt, sent_at: log.sentAt ?? null, failed_at: log.failedAt ?? null,
    }, { onConflict: "id" });
    if (error) failOrSchemaMissing("runtime_email_sends", error);
    return log;
  }

  async listEmailSendLogs(eventId: string, limit = 200) {
    const { data, error } = await this.client.from("runtime_email_sends").select("*").eq("event_id", eventId).order("queued_at", { ascending: false }).limit(limit);
    if (error) failOrSchemaMissing("runtime_email_sends", error);
    return ((data || []) as Record<string, unknown>[]).map(mapEmailSendLog);
  }

  async listAllEmailSendLogs(limit = 500) {
    const { data, error } = await this.client.from("runtime_email_sends").select("*").order("queued_at", { ascending: false }).limit(limit);
    if (error) failOrSchemaMissing("runtime_email_sends", error);
    return ((data || []) as Record<string, unknown>[]).map(mapEmailSendLog);
  }

  async probeContactsArchiveColumn() {
    const { error } = await this.client.from("contacts").select("archived_at").limit(1);
    if (error) fail(`contacts.archived_at read: ${error.message} — apply supabase/migrations/20260916190000_contact_archive.sql`);
    return { ok: true as const };
  }

  async upsertSpeedNetworkingEntry(entry: SpeedNetworkingQueueEntry) {
    const { error } = await this.client.from("networking_queue_entries").upsert({ id: entry.id, event_id: entry.eventId, attendee_id: entry.attendeeId, display_name: entry.displayName, company: entry.company, title: entry.title, status: entry.status, joined_at: entry.joinedAt, matched_at: entry.matchedAt ?? null, match_id: entry.matchId ?? null, matches_completed: entry.matchesCompleted, updated_at: entry.updatedAt }, { onConflict: "id" });
    if (error) failOrSchemaMissing("networking_queue_entries", error);
    return entry;
  }

  async getSpeedNetworkingEntry(eventId: string, attendeeId: string) {
    const { data, error } = await this.client.from("networking_queue_entries").select("*").eq("event_id", eventId).eq("attendee_id", attendeeId).maybeSingle();
    if (error) failOrSchemaMissing("networking_queue_entries", error);
    return data ? mapSpeedNetworkingEntry(data as Record<string, unknown>) : undefined;
  }

  async listSpeedNetworkingEntries(eventId: string) {
    const { data, error } = await this.client.from("networking_queue_entries").select("*").eq("event_id", eventId).order("joined_at", { ascending: true });
    if (error) failOrSchemaMissing("networking_queue_entries", error);
    return ((data || []) as Record<string, unknown>[]).map(mapSpeedNetworkingEntry);
  }

  async upsertSpeedNetworkingMatch(match: SpeedNetworkingMatchRecord) {
    const { error } = await this.client.from("networking_queue_matches").upsert({ id: match.id, event_id: match.eventId, attendee_a_id: match.attendeeAId, attendee_b_id: match.attendeeBId, normalized_pair_key: match.normalizedPairKey, room_name: match.roomName, status: match.status, starts_at: match.startsAt, expires_at: match.expiresAt, ended_at: match.endedAt ?? null, ended_reason: match.endedReason ?? null }, { onConflict: "id" });
    if (error) failOrSchemaMissing("networking_queue_matches", error);
    return match;
  }

  async getSpeedNetworkingMatch(eventId: string, matchId: string) {
    const { data, error } = await this.client.from("networking_queue_matches").select("*").eq("event_id", eventId).eq("id", matchId).maybeSingle();
    if (error) failOrSchemaMissing("networking_queue_matches", error);
    return data ? mapSpeedNetworkingMatch(data as Record<string, unknown>) : undefined;
  }

  async listSpeedNetworkingMatches(eventId: string) {
    const { data, error } = await this.client.from("networking_queue_matches").select("*").eq("event_id", eventId).order("starts_at", { ascending: false });
    if (error) failOrSchemaMissing("networking_queue_matches", error);
    return ((data || []) as Record<string, unknown>[]).map(mapSpeedNetworkingMatch);
  }

  async upsertRuntimeEvent(event: RuntimeEventRecord) {
    const { error } = await this.client.from("runtime_events").upsert(runtimeEventToRow(event), { onConflict: "id" });
    if (error) failOrSchemaMissing("runtime_events", error);
    return event;
  }

  async getRuntimeEvent(idOrSlugOrJoinCode: string) {
    const key = idOrSlugOrJoinCode.trim().toLowerCase();
    if (!key || !/^[a-z0-9][a-z0-9-]*$/.test(key)) return undefined;
    const { data, error } = await this.client
      .from("runtime_events")
      .select("*")
      .or(`id.eq.${key},slug.eq.${key},join_code.eq.${key}`)
      .limit(1)
      .maybeSingle();
    if (error) failOrSchemaMissing("runtime_events", error);
    return data ? rowToRuntimeEvent(data as Record<string, unknown>) : undefined;
  }

  async listRuntimeEvents() {
    const { data, error } = await this.client.from("runtime_events").select("*").order("created_at", { ascending: false });
    if (error) failOrSchemaMissing("runtime_events", error);
    return ((data || []) as Record<string, unknown>[]).map(rowToRuntimeEvent);
  }

  async upsertRuntimeClient(client: RuntimeClientRecord) {
    const { error } = await this.client.from("runtime_clients").upsert(runtimeClientToRow(client), { onConflict: "id" });
    if (error) failOrSchemaMissing("runtime_clients", error);
    return client;
  }

  async listRuntimeClients() {
    const { data, error } = await this.client.from("runtime_clients").select("*").order("name", { ascending: true });
    if (error) failOrSchemaMissing("runtime_clients", error);
    return ((data || []) as Record<string, unknown>[]).map(rowToRuntimeClient);
  }

  async getAgencySettings(id: string) {
    const { data, error } = await this.client.from("runtime_agency_settings").select("*").eq("id", id).maybeSingle();
    if (error) failOrSchemaMissing("runtime_agency_settings", error);
    return data ? rowToAgencySettings(data as Record<string, unknown>) : undefined;
  }

  async setAgencySettings(settings: AgencySettingsRecord) {
    const { error } = await this.client.from("runtime_agency_settings").upsert({
      id: settings.id,
      agency_name: settings.agencyName,
      primary_color: settings.primaryColor,
      accent_color: settings.accentColor,
      members: settings.members,
      updated_by: settings.updatedBy,
      updated_by_label: settings.updatedByLabel,
      updated_at: settings.updatedAt,
    }, { onConflict: "id" });
    if (error) failOrSchemaMissing("runtime_agency_settings", error);
    return settings;
  }

  async upsertEventRequest(request: EventRequestRecord) {
    const { error } = await this.client.from("request_event_intake").upsert(eventRequestToRow(request), { onConflict: "id" });
    if (error) failOrSchemaMissing("request_event_intake", error);
    return request;
  }

  async getEventRequest(id: string) {
    const { data, error } = await this.client.from("request_event_intake").select("*").eq("id", id).maybeSingle();
    if (error) failOrSchemaMissing("request_event_intake", error);
    return data ? mapEventRequest(data as Record<string, unknown>) : undefined;
  }

  async getEventRequestByConfirmToken(token: string) {
    if (!token) return undefined;
    const { data, error } = await this.client.from("request_event_intake").select("*").eq("confirm_token", token).maybeSingle();
    if (error) failOrSchemaMissing("request_event_intake", error);
    return data ? mapEventRequest(data as Record<string, unknown>) : undefined;
  }

  async listEventRequests(limit = 500) {
    const { data, error } = await this.client.from("request_event_intake").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) failOrSchemaMissing("request_event_intake", error);
    return ((data || []) as Record<string, unknown>[]).map(mapEventRequest);
  }

  async getHowItWorksPage(slug: HowItWorksAudience) {
    const { data, error } = await this.client.from("how_it_works_pages").select("*").eq("slug", slug).maybeSingle();
    if (error) failOrSchemaMissing("how_it_works_pages", error);
    return data ? mapHowItWorksPage(data as Record<string, unknown>) : undefined;
  }

  async listHowItWorksPages() {
    const { data, error } = await this.client.from("how_it_works_pages").select("*");
    if (error) failOrSchemaMissing("how_it_works_pages", error);
    return ((data || []) as Record<string, unknown>[]).map(mapHowItWorksPage);
  }

  async setHowItWorksPage(page: HowItWorksPageRecord) {
    const { error } = await this.client.from("how_it_works_pages").upsert({
      slug: page.slug, title: page.title, intro: page.intro, body: page.body,
      updated_by: page.updatedBy, updated_by_label: page.updatedByLabel, updated_at: page.updatedAt,
    }, { onConflict: "slug" });
    if (error) failOrSchemaMissing("how_it_works_pages", error);
    return page;
  }

  async readSnapshot(): Promise<V6RuntimeSnapshot> {
    const snapshot = emptyRuntimeSnapshot();
    const [auditLogs, accessAttempts, analyticsEvents, fallbackEvents, fallbackStates, incidentEvents, supportRequests, emailEvents, registrations, attendeeProfiles, attendeeSessions, attendeeAgendaIntents, sponsorLeadOptIns, attendeePermissions, runOfShowEvents, stageStreamStates, stageStreamEvents, liveChatMessages, attendeeLiveCapabilities, attendeeLiveControlStates, liveChatModerationStates, specialGuestProfiles, eventGuestStates, speedNetworkingEntries, speedNetworkingMatches, contacts] = await Promise.all([
      selectAll<Record<string, unknown>>(this.client, "audit_logs"),
      selectAll<Record<string, unknown>>(this.client, "v5_access_attempt_events"),
      selectAll<Record<string, unknown>>(this.client, "v5_analytics_events"),
      selectAll<Record<string, unknown>>(this.client, "v5_runtime_fallback_events"),
      selectAll<Record<string, unknown>>(this.client, "v6_room_fallback_states", "*", "updated_at"),
      selectAll<Record<string, unknown>>(this.client, "v6_incident_events"),
      selectAll<Record<string, unknown>>(this.client, "v6_support_requests"),
      selectAll<Record<string, unknown>>(this.client, "v6_email_events"),
      selectAll<Record<string, unknown>>(this.client, "v6_registration_events"),
      selectAll<Record<string, unknown>>(this.client, "attendee_profiles", "*", "updated_at"),
      selectAll<Record<string, unknown>>(this.client, "attendee_sessions", "*", "issued_at"),
      selectAll<Record<string, unknown>>(this.client, "attendee_agenda_intents", "*", "updated_at"),
      selectAll<Record<string, unknown>>(this.client, "sponsor_lead_opt_ins"),
      selectAll<Record<string, unknown>>(this.client, "attendee_permissions", "*", "updated_at"),
      selectAll<Record<string, unknown>>(this.client, "v6_run_of_show_runtime_events"),
      selectAll<Record<string, unknown>>(this.client, "stage_stream_states", "*", "updated_at"),
      selectAll<Record<string, unknown>>(this.client, "stage_stream_events"),
      selectAll<Record<string, unknown>>(this.client, "live_chat_messages"),
      selectAll<Record<string, unknown>>(this.client, "attendee_live_capabilities", "*", "updated_at"),
      selectAll<Record<string, unknown>>(this.client, "attendee_live_control_states", "*", "updated_at"),
      // Diagnostic snapshot only: an unapplied 0025 must not take the testing console down with it.
      // The moderation paths themselves surface RuntimeSchemaMissingError by name.
      selectAll<Record<string, unknown>>(this.client, "live_chat_moderation_states", "*", "updated_at").catch(tolerateMissingTable),
      selectAll<Record<string, unknown>>(this.client, "special_guest_profiles", "*", "created_at").catch(tolerateMissingTable),
      selectAll<Record<string, unknown>>(this.client, "event_guest_states", "*", "updated_at").catch(tolerateMissingTable),
      selectAll<Record<string, unknown>>(this.client, "networking_queue_entries", "*", "updated_at").catch(tolerateMissingTable),
      selectAll<Record<string, unknown>>(this.client, "networking_queue_matches", "*", "starts_at").catch(tolerateMissingTable),
      selectAll<Record<string, unknown>>(this.client, "contacts", "*", "updated_at").catch(tolerateMissingTable),
    ]);

    snapshot.auditLogs = auditLogs.map((row) => ({
      id: String(row.id),
      agencyId: String(row.agency_id || ""),
      clientId: row.client_id ? String(row.client_id) : undefined,
      eventId: row.event_id ? String(row.event_id) : undefined,
      actorUserId: String(row.actor_user_id || ""),
      actorRole: String(row.actor_role || ""),
      action: String(row.action || ""),
      resourceType: String(row.resource_type || ""),
      resourceId: String(row.resource_id || ""),
      createdAt: String(row.created_at || ""),
      visibility: (row.visibility as AuditLog["visibility"]) || "internal_agency",
    }));
    snapshot.accessAttempts = accessAttempts.map((row) => ({
      id: String(row.id),
      status: row.status as V5AccessAttemptRuntimeEvent["status"],
      accessKind: row.access_kind as V5AccessAttemptRuntimeEvent["accessKind"],
      eventId: row.event_id ? String(row.event_id) : undefined,
      role: row.role ? String(row.role) : undefined,
      route: row.route ? String(row.route) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      ipHash: row.ip_hash ? String(row.ip_hash) : undefined,
      userAgentHash: row.user_agent_hash ? String(row.user_agent_hash) : undefined,
      createdAt: String(row.created_at || ""),
    }));
    snapshot.analyticsEvents = analyticsEvents.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id || ""),
      kind: row.kind as V4AnalyticsEvent["kind"],
      subjectId: row.subject_id ? String(row.subject_id) : undefined,
      metadata: (row.metadata as V4AnalyticsEvent["metadata"]) || {},
      createdAt: String(row.created_at || ""),
    }));
    snapshot.fallbackEvents = fallbackEvents.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id || ""),
      roomId: String(row.room_id || ""),
      roomType: String(row.room_type || ""),
      provider: row.provider as V5FallbackRuntimeEvent["provider"],
      action: row.action as V5FallbackRuntimeEvent["action"],
      actorRole: row.actor_role ? String(row.actor_role) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: String(row.created_at || ""),
    }));
    snapshot.fallbackStates = fallbackStates.map((row) => row.state as V4RoomFallbackState).filter(Boolean);
    snapshot.incidentEvents = incidentEvents.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id || ""),
      title: String(row.title || ""),
      severity: row.severity as V6IncidentRuntimeEvent["severity"],
      status: row.status as V6IncidentRuntimeEvent["status"],
      ownerRole: String(row.owner_role || ""),
      details: String(row.details || ""),
      createdAt: String(row.created_at || ""),
    }));
    snapshot.supportRequests = supportRequests.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id || ""),
      attendeeId: row.attendee_id ? String(row.attendee_id) : undefined,
      subject: String(row.subject || ""),
      status: row.status as V6SupportRequestRuntimeEvent["status"],
      createdAt: String(row.created_at || ""),
    }));
    snapshot.emailEvents = emailEvents.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id || ""),
      templateKey: String(row.template_key || ""),
      recipientSegment: String(row.recipient_segment || ""),
      status: row.status as V6EmailRuntimeEvent["status"],
      providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: String(row.created_at || ""),
    }));
    snapshot.registrations = registrations.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id || ""),
      attendeeEmailHash: String(row.attendee_email_hash || ""),
      status: row.status as V6RegistrationRuntimeEvent["status"],
      displayName: row.display_name ? String(row.display_name) : undefined,
      company: row.company ? String(row.company) : undefined,
      title: row.title ? String(row.title) : undefined,
      personalWebsite: row.personal_website ? String(row.personal_website) : undefined,
      socialLinks: Array.isArray(row.social_links) ? row.social_links.map(String) : [],
      reasonForAttending: row.reason_for_attending ? String(row.reason_for_attending) : undefined,
      interestingFact: row.interesting_fact ? String(row.interesting_fact) : undefined,
      createdAt: String(row.created_at || ""),
    }));
    snapshot.attendeeProfiles = attendeeProfiles.map((row) => mapAttendeeProfile(row));
    snapshot.attendeeSessions = attendeeSessions.map((row) => mapAttendeeSession(row));
    snapshot.attendeeAgendaIntents = attendeeAgendaIntents.map((row) => mapAttendeeAgendaIntent(row));
    snapshot.sponsorLeadOptIns = sponsorLeadOptIns.map((row) => ({ id: String(row.id), attendeeId: String(row.attendee_id || ""), eventId: String(row.event_id || ""), sponsorBoothId: String(row.sponsor_booth_id || ""), allowedFields: Array.isArray(row.allowed_fields) ? row.allowed_fields.map(String) : [], createdAt: String(row.created_at || "") }));
    snapshot.attendeePermissions = attendeePermissions.map((row) => ({ id: String(row.id || ""), attendeeId: String(row.attendee_id || ""), eventId: String(row.event_id || ""), permissionKind: row.permission_kind as AttendeePermission["permissionKind"], granted: Boolean(row.granted), grantedBy: row.granted_by ? String(row.granted_by) : undefined, reason: row.reason ? String(row.reason) : undefined, updatedAt: String(row.updated_at || "") }));
    snapshot.runOfShowEvents = runOfShowEvents.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id || ""),
      segmentId: String(row.segment_id || ""),
      action: row.action as V6RunOfShowRuntimeEvent["action"],
      actorRole: String(row.actor_role || ""),
      createdAt: String(row.created_at || ""),
    }));
    snapshot.stageStreamStates = stageStreamStates.map((row) => row.state as StageStreamState).filter(Boolean);
    snapshot.stageStreamEvents = stageStreamEvents.map((row) => row.state_event as StageStreamEvent).filter(Boolean);
    snapshot.liveChatMessages = liveChatMessages.map(mapLiveChatMessage);
    snapshot.liveChatModerationStates = liveChatModerationStates.map((row) => row.state as LiveChatModerationState).filter(Boolean);
    snapshot.specialGuestProfiles = specialGuestProfiles.map(mapSpecialGuestProfile);
    snapshot.eventGuestStates = eventGuestStates.map(mapEventGuestState);
    snapshot.speedNetworkingEntries = speedNetworkingEntries.map(mapSpeedNetworkingEntry);
    snapshot.speedNetworkingMatches = speedNetworkingMatches.map(mapSpeedNetworkingMatch);
    snapshot.contacts = contacts.map(mapContact);
    snapshot.attendeeLiveCapabilities = attendeeLiveCapabilities.map((row) => row.capability as AttendeeLiveCapability).filter(Boolean);
    snapshot.attendeeLiveControlStates = attendeeLiveControlStates.map((row) => row.state as AttendeeLiveControlState).filter(Boolean);
    return snapshot;
  }
}
