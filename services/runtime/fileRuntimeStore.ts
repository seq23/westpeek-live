import type { AuditLog } from "@/types/core";
import type { V4AnalyticsEvent, V4RoomFallbackState } from "@/types/v4";
import type { StageStreamEvent, StageStreamState } from "@/types/stageStream";
import type { LiveChatMessage, LiveChatModerationState } from "@/types/liveChat";
import type { AttendeeLiveCapability, AttendeeLiveControlState } from "@/types/attendeeLive";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { AttendeeAgendaIntent, AttendeePermission, AttendeeSession, SponsorLeadOptIn } from "@/types/attendeeSession";
import type { AgencySettingsRecord, RuntimeClientRecord, RuntimeEventRecord } from "@/types/runtimeEvent";
import type { EventGuestStateRecord, SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";
import type { SpeedNetworkingMatchRecord, SpeedNetworkingQueueEntry } from "@/types/speedNetworking";
import type { EventAssetRecord } from "@/types/eventAssets";
import type { EmailSendLog } from "@/types/emailProduction";
import type { ContactRecord } from "@/types/attendeeRegistration";
import { emptyRuntimeSnapshot, type RuntimeStore, type V5AccessAttemptRuntimeEvent, type V5FallbackRuntimeEvent, type V6EmailRuntimeEvent, type V6IncidentRuntimeEvent, type V6RegistrationRuntimeEvent, type V6RunOfShowRuntimeEvent, type V6RuntimeSnapshot, type V6SupportRequestRuntimeEvent } from "./runtimeStore";

declare const require: undefined | ((moduleName: string) => unknown);

type FsLike = {
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
  readFileSync: (path: string, encoding: string) => string;
  renameSync: (from: string, to: string) => void;
  writeFileSync: (path: string, body: string, encoding: string) => void;
};

type PathLike = {
  dirname: (path: string) => string;
  join: (...parts: string[]) => string;
};

let memorySnapshot = emptyRuntimeSnapshot();

function getNodeFs(): FsLike | undefined {
  try {
    if (typeof require !== "function") return undefined;
    return require("fs") as FsLike;
  } catch {
    return undefined;
  }
}

function getNodePath(): PathLike | undefined {
  try {
    if (typeof require !== "function") return undefined;
    return require("path") as PathLike;
  } catch {
    return undefined;
  }
}

function defaultRuntimePath() {
  const path = getNodePath();
  return path ? path.join(process.cwd(), ".runtime-data", "agency-event-os-runtime.json") : "agency-event-os-runtime-memory-only.json";
}

function cloneSnapshot(snapshot: V6RuntimeSnapshot): V6RuntimeSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as V6RuntimeSnapshot;
}

function readSnapshotFile(filePath: string): V6RuntimeSnapshot {
  const fs = getNodeFs();
  if (!fs) return cloneSnapshot(memorySnapshot);
  if (!fs.existsSync(filePath)) return emptyRuntimeSnapshot();
  // Local file store only. A read that lands between another dev-server process's write and rename
  // can see a torn file; re-read a few times before giving up (three attendee pages polling
  // networking every 5s surfaced this once, 16 Sep 2026). Production uses Supabase.
  let parsed: Partial<V6RuntimeSnapshot> | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5 && !parsed; attempt += 1) {
    try { parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<V6RuntimeSnapshot>; } catch (error) { lastError = error; }
  }
  if (!parsed) throw lastError instanceof Error ? lastError : new Error("Runtime snapshot file could not be read.");
  return {
    ...emptyRuntimeSnapshot(),
    ...parsed,
    fallbackStates: Array.isArray(parsed.fallbackStates) ? parsed.fallbackStates : [],
    stageStreamStates: Array.isArray(parsed.stageStreamStates) ? parsed.stageStreamStates : [],
    stageStreamEvents: Array.isArray(parsed.stageStreamEvents) ? parsed.stageStreamEvents : [],
    liveChatMessages: Array.isArray(parsed.liveChatMessages) ? parsed.liveChatMessages : [],
    liveChatModerationStates: Array.isArray(parsed.liveChatModerationStates) ? parsed.liveChatModerationStates : [],
    attendeeProfiles: Array.isArray(parsed.attendeeProfiles) ? parsed.attendeeProfiles : [],
    attendeeSessions: Array.isArray(parsed.attendeeSessions) ? parsed.attendeeSessions : [],
    attendeeAgendaIntents: Array.isArray(parsed.attendeeAgendaIntents) ? parsed.attendeeAgendaIntents : [],
    sponsorLeadOptIns: Array.isArray(parsed.sponsorLeadOptIns) ? parsed.sponsorLeadOptIns : [],
    attendeePermissions: Array.isArray(parsed.attendeePermissions) ? parsed.attendeePermissions : [],
    attendeeLiveCapabilities: Array.isArray(parsed.attendeeLiveCapabilities) ? parsed.attendeeLiveCapabilities : [],
    attendeeLiveControlStates: Array.isArray(parsed.attendeeLiveControlStates) ? parsed.attendeeLiveControlStates : [],
    specialGuestProfiles: Array.isArray(parsed.specialGuestProfiles) ? parsed.specialGuestProfiles : [],
    eventGuestStates: Array.isArray(parsed.eventGuestStates) ? parsed.eventGuestStates : [],
    speedNetworkingEntries: Array.isArray(parsed.speedNetworkingEntries) ? parsed.speedNetworkingEntries : [],
    speedNetworkingMatches: Array.isArray(parsed.speedNetworkingMatches) ? parsed.speedNetworkingMatches : [],
    contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
    runtimeEvents: Array.isArray(parsed.runtimeEvents) ? parsed.runtimeEvents : [],
    runtimeClients: Array.isArray(parsed.runtimeClients) ? parsed.runtimeClients : [],
    agencySettings: Array.isArray(parsed.agencySettings) ? parsed.agencySettings : [],
  };
}

function writeSnapshotFile(filePath: string, snapshot: V6RuntimeSnapshot) {
  const fs = getNodeFs();
  const path = getNodePath();
  if (!fs || !path) {
    memorySnapshot = cloneSnapshot(snapshot);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, filePath);
}

export class FileRuntimeStore implements RuntimeStore {
  readonly kind = "file" as const;
  private readonly filePath: string;

  constructor(filePath = process.env.AGENCY_EVENT_OS_RUNTIME_STORE_PATH || defaultRuntimePath()) {
    this.filePath = filePath;
  }

  private read() {
    return readSnapshotFile(this.filePath);
  }

  private write(snapshot: V6RuntimeSnapshot) {
    writeSnapshotFile(this.filePath, snapshot);
  }

  async appendAuditLog(log: AuditLog) {
    const snapshot = this.read();
    snapshot.auditLogs.push(log);
    this.write(snapshot);
    return log;
  }

  async appendAccessAttempt(event: V5AccessAttemptRuntimeEvent) {
    const snapshot = this.read();
    snapshot.accessAttempts.push(event);
    this.write(snapshot);
    return event;
  }

  async appendAnalyticsEvent(event: V4AnalyticsEvent) {
    const snapshot = this.read();
    snapshot.analyticsEvents.push(event);
    this.write(snapshot);
    return event;
  }

  async appendFallbackEvent(event: V5FallbackRuntimeEvent) {
    const snapshot = this.read();
    snapshot.fallbackEvents.push(event);
    this.write(snapshot);
    return event;
  }

  async getFallbackState(key: string) {
    const snapshot = this.read();
    return snapshot.fallbackStates.find((state) => `${state.eventId}:${state.roomType}` === key);
  }

  async setFallbackState(key: string, state: V4RoomFallbackState) {
    const snapshot = this.read();
    snapshot.fallbackStates = snapshot.fallbackStates.filter((item) => `${item.eventId}:${item.roomType}` !== key);
    snapshot.fallbackStates.push(state);
    this.write(snapshot);
    return state;
  }

  async appendIncident(event: V6IncidentRuntimeEvent) {
    const snapshot = this.read();
    snapshot.incidentEvents.push(event);
    this.write(snapshot);
    return event;
  }

  async appendSupportRequest(event: V6SupportRequestRuntimeEvent) {
    const snapshot = this.read();
    snapshot.supportRequests.push(event);
    this.write(snapshot);
    return event;
  }

  async appendEmailEvent(event: V6EmailRuntimeEvent) {
    const snapshot = this.read();
    snapshot.emailEvents.push(event);
    this.write(snapshot);
    return event;
  }

  async appendRegistration(event: V6RegistrationRuntimeEvent) {
    const snapshot = this.read();
    snapshot.registrations.push(event);
    this.write(snapshot);
    return event;
  }


  async upsertAttendeeProfile(profile: AttendeeProfile) {
    const snapshot = this.read();
    snapshot.attendeeProfiles = snapshot.attendeeProfiles.filter((item: AttendeeProfile) => !(item.eventId === profile.eventId && item.attendeeId === profile.attendeeId));
    snapshot.attendeeProfiles.push(profile);
    this.write(snapshot);
    return profile;
  }

  async getAttendeeProfile(eventId: string, attendeeId: string) {
    const snapshot = this.read();
    return snapshot.attendeeProfiles.find((item: AttendeeProfile) => item.eventId === eventId && item.attendeeId === attendeeId);
  }

  async getAttendeeProfileByEmailHash(eventId: string, emailHash: string) {
    const snapshot = this.read();
    return snapshot.attendeeProfiles.find((item: AttendeeProfile) => item.eventId === eventId && item.emailHash === emailHash);
  }

  async listAttendeeProfiles(eventId: string, limit = 100) {
    const snapshot = this.read();
    return snapshot.attendeeProfiles.filter((item: AttendeeProfile) => item.eventId === eventId && item.status === "active").sort((a: AttendeeProfile, b: AttendeeProfile) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, limit);
  }

  async listAttendeeProfilesByEmailHash(emailHash: string) {
    return this.read().attendeeProfiles.filter((item: AttendeeProfile) => item.emailHash === emailHash);
  }

  async listAttendeeProfilesWithoutEmail(limit = 5000) {
    return this.read().attendeeProfiles.filter((item: AttendeeProfile) => !item.email && item.status === "active").slice(0, limit);
  }

  async upsertAttendeeSession(session: AttendeeSession) {
    const snapshot = this.read();
    snapshot.attendeeSessions = snapshot.attendeeSessions.filter((item: AttendeeSession) => !(item.eventId === session.eventId && item.sessionId === session.sessionId));
    snapshot.attendeeSessions.push(session);
    this.write(snapshot);
    return session;
  }

  async getAttendeeSession(eventId: string, sessionId: string) {
    const snapshot = this.read();
    return snapshot.attendeeSessions.find((item: AttendeeSession) => item.eventId === eventId && item.sessionId === sessionId);
  }

  async listAttendeeSessions(eventId: string, limit = 500) {
    const snapshot = this.read();
    return snapshot.attendeeSessions
      .filter((item: AttendeeSession) => item.eventId === eventId)
      .sort((a: AttendeeSession, b: AttendeeSession) => String(b.lastSeenAt || b.issuedAt).localeCompare(String(a.lastSeenAt || a.issuedAt)))
      .slice(0, limit);
  }

  async upsertAttendeeAgendaIntent(intent: AttendeeAgendaIntent) {
    const snapshot = this.read();
    snapshot.attendeeAgendaIntents = snapshot.attendeeAgendaIntents.filter((item: AttendeeAgendaIntent) => !(item.eventId === intent.eventId && item.attendeeId === intent.attendeeId));
    snapshot.attendeeAgendaIntents.push(intent);
    this.write(snapshot);
    return intent;
  }

  async getAttendeeAgendaIntent(eventId: string, attendeeId: string) {
    const snapshot = this.read();
    return snapshot.attendeeAgendaIntents.find((item: AttendeeAgendaIntent) => item.eventId === eventId && item.attendeeId === attendeeId);
  }

  async appendSponsorLeadOptIn(optIn: SponsorLeadOptIn) {
    const snapshot = this.read();
    snapshot.sponsorLeadOptIns.push(optIn);
    this.write(snapshot);
    return optIn;
  }



  async upsertAttendeePermission(permission: AttendeePermission) {
    const snapshot = this.read();
    snapshot.attendeePermissions = snapshot.attendeePermissions.filter((item: AttendeePermission) => !(item.eventId === permission.eventId && item.attendeeId === permission.attendeeId && item.permissionKind === permission.permissionKind));
    snapshot.attendeePermissions.push(permission);
    this.write(snapshot);
    return permission;
  }

  async listAttendeePermissions(eventId: string, attendeeId: string) {
    const snapshot = this.read();
    return snapshot.attendeePermissions.filter((item: AttendeePermission) => item.eventId === eventId && item.attendeeId === attendeeId);
  }

  async appendRunOfShowEvent(event: V6RunOfShowRuntimeEvent) {
    const snapshot = this.read();
    snapshot.runOfShowEvents.push(event);
    this.write(snapshot);
    return event;
  }



  async getStageStreamState(key: string) {
    const snapshot = this.read();
    return snapshot.stageStreamStates.find((state: StageStreamState) => `${state.eventId}:${state.stageId}` === key);
  }

  async setStageStreamState(key: string, state: StageStreamState) {
    const snapshot = this.read();
    snapshot.stageStreamStates = snapshot.stageStreamStates.filter((item: StageStreamState) => `${item.eventId}:${item.stageId}` !== key);
    snapshot.stageStreamStates.push(state);
    this.write(snapshot);
    return state;
  }

  async appendStageStreamEvent(event: StageStreamEvent) {
    const snapshot = this.read();
    snapshot.stageStreamEvents.push(event);
    this.write(snapshot);
    return event;
  }

  async listStageStreamEvents(eventId: string, stageId: string, limit: number) {
    return this.read().stageStreamEvents
      .filter((item: StageStreamEvent) => item.eventId === eventId && item.stageId === stageId)
      .sort((a: StageStreamEvent, b: StageStreamEvent) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, limit));
  }

  async appendLiveChatMessage(message: LiveChatMessage) {
    const snapshot = this.read();
    snapshot.liveChatMessages.push(message);
    this.write(snapshot);
    return message;
  }

  async listLiveChatMessages(eventId: string, roomKind: string, roomId: string, options?: { includeHidden?: boolean }) {
    const snapshot = this.read();
    return snapshot.liveChatMessages.filter((message: LiveChatMessage) => message.eventId === eventId && message.roomKind === roomKind && message.roomId === roomId && (options?.includeHidden || message.moderationStatus !== "hidden"));
  }

  async listRecentLiveChatMessages(eventId: string, limit: number) {
    const snapshot = this.read();
    // Newest first; same-millisecond posts keep insertion order (later insert = newer).
    return snapshot.liveChatMessages
      .map((message: LiveChatMessage, index: number) => ({ message, index }))
      .filter(({ message }) => message.eventId === eventId)
      .sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt) || b.index - a.index)
      .slice(0, Math.max(1, limit))
      .map(({ message }) => message);
  }

  async updateLiveChatMessageModeration(input: { id: string; eventId: string; moderationStatus: LiveChatMessage["moderationStatus"]; moderatedBy: string; moderatedAt: string }) {
    const snapshot = this.read();
    const message = snapshot.liveChatMessages.find((item: LiveChatMessage) => item.id === input.id && item.eventId === input.eventId);
    if (!message) return undefined;
    message.moderationStatus = input.moderationStatus;
    message.moderatedBy = input.moderatedBy;
    message.moderatedAt = input.moderatedAt;
    this.write(snapshot);
    return { ...message };
  }

  async setLiveChatModerationState(state: LiveChatModerationState) {
    const snapshot = this.read();
    snapshot.liveChatModerationStates = snapshot.liveChatModerationStates.filter((item: LiveChatModerationState) => item.key !== state.key);
    snapshot.liveChatModerationStates.push(state);
    this.write(snapshot);
    return state;
  }

  async getLiveChatModerationState(key: string) {
    return this.read().liveChatModerationStates.find((item: LiveChatModerationState) => item.key === key);
  }

  async listLiveChatModerationStates(eventId: string) {
    return this.read().liveChatModerationStates.filter((item: LiveChatModerationState) => item.eventId === eventId);
  }

  async setAttendeeLiveCapability(key: string, capability: AttendeeLiveCapability) {
    const snapshot = this.read();
    snapshot.attendeeLiveCapabilities = snapshot.attendeeLiveCapabilities.filter((item: AttendeeLiveCapability) => `${item.eventId}:${item.roomKind}:${item.roomId}:${item.attendeeId}` !== key);
    snapshot.attendeeLiveCapabilities.push(capability);
    this.write(snapshot);
    return capability;
  }

  async getAttendeeLiveCapability(key: string) {
    const snapshot = this.read();
    return snapshot.attendeeLiveCapabilities.find((item: AttendeeLiveCapability) => `${item.eventId}:${item.roomKind}:${item.roomId}:${item.attendeeId}` === key);
  }

  async listAttendeeLiveCapabilities(eventId: string) {
    return this.read().attendeeLiveCapabilities.filter((item: AttendeeLiveCapability) => item.eventId === eventId);
  }

  async setAttendeeLiveControlState(key: string, state: AttendeeLiveControlState) {
    const snapshot = this.read();
    snapshot.attendeeLiveControlStates = snapshot.attendeeLiveControlStates.filter((item: AttendeeLiveControlState) => `${item.eventId}:${item.roomKind}:${item.roomId}` !== key);
    snapshot.attendeeLiveControlStates.push(state);
    this.write(snapshot);
    return state;
  }

  async getAttendeeLiveControlState(key: string) {
    const snapshot = this.read();
    return snapshot.attendeeLiveControlStates.find((item: AttendeeLiveControlState) => `${item.eventId}:${item.roomKind}:${item.roomId}` === key);
  }

  async upsertSpecialGuestProfile(profile: SpecialGuestProfile) {
    const snapshot = this.read();
    snapshot.specialGuestProfiles = snapshot.specialGuestProfiles.filter((item: SpecialGuestProfile) => !(item.eventId === profile.eventId && item.guestId === profile.guestId));
    snapshot.specialGuestProfiles.push(profile);
    this.write(snapshot);
    return profile;
  }

  async getSpecialGuestProfile(eventId: string, guestId: string) {
    return this.read().specialGuestProfiles.find((item: SpecialGuestProfile) => item.eventId === eventId && item.guestId === guestId);
  }

  async listSpecialGuestProfiles(eventId: string, role?: SpecialGuestRole) {
    return this.read().specialGuestProfiles.filter((item: SpecialGuestProfile) => item.eventId === eventId && (!role || item.role === role)).sort((a: SpecialGuestProfile, b: SpecialGuestProfile) => a.createdAt.localeCompare(b.createdAt));
  }

  async setEventGuestState(record: EventGuestStateRecord) {
    const snapshot = this.read();
    snapshot.eventGuestStates = snapshot.eventGuestStates.filter((item: EventGuestStateRecord) => item.key !== record.key);
    snapshot.eventGuestStates.push(record);
    this.write(snapshot);
    return record;
  }

  async getEventGuestState(key: string) {
    return this.read().eventGuestStates.find((item: EventGuestStateRecord) => item.key === key);
  }

  async listEventGuestStates(eventId: string, kind?: string) {
    return this.read().eventGuestStates.filter((item: EventGuestStateRecord) => item.eventId === eventId && (!kind || item.kind === kind));
  }

  async upsertContact(contact: ContactRecord) {
    const snapshot = this.read();
    snapshot.contacts = snapshot.contacts.filter((item) => item.email !== contact.email);
    snapshot.contacts.push(contact);
    this.write(snapshot);
    return contact;
  }

  async getContact(email: string) {
    return this.read().contacts.find((item) => item.email === email);
  }

  async listContacts() {
    return this.read().contacts.slice().sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  async upsertEventAsset(asset: EventAssetRecord) {
    const snapshot = this.read();
    snapshot.eventAssets = (snapshot.eventAssets || []).filter((item: EventAssetRecord) => item.id !== asset.id);
    snapshot.eventAssets.push(asset);
    this.write(snapshot);
    return asset;
  }

  async getEventAsset(id: string) {
    return (this.read().eventAssets || []).find((item: EventAssetRecord) => item.id === id);
  }

  async listEventAssets(eventId: string, includeArchived = false) {
    return (this.read().eventAssets || [])
      .filter((item: EventAssetRecord) => item.eventId === eventId && (includeArchived || !item.archivedAt))
      .sort((a: EventAssetRecord, b: EventAssetRecord) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAllEventAssets(includeArchived = false) {
    return (this.read().eventAssets || [])
      .filter((item: EventAssetRecord) => includeArchived || !item.archivedAt)
      .sort((a: EventAssetRecord, b: EventAssetRecord) => b.createdAt.localeCompare(a.createdAt));
  }

  async appendEmailSendLog(log: EmailSendLog & { sentBy?: string }) {
    const snapshot = this.read();
    snapshot.emailSendLogs = [...(snapshot.emailSendLogs || []).filter((item: EmailSendLog) => item.id !== log.id), log];
    this.write(snapshot);
    return log;
  }

  async listEmailSendLogs(eventId: string, limit = 200) {
    return (this.read().emailSendLogs || [])
      .filter((item: EmailSendLog) => item.eventId === eventId)
      .sort((a: EmailSendLog, b: EmailSendLog) => b.queuedAt.localeCompare(a.queuedAt))
      .slice(0, limit);
  }

  async listAllEmailSendLogs(limit = 500) {
    return (this.read().emailSendLogs || [])
      .slice()
      .sort((a: EmailSendLog, b: EmailSendLog) => b.queuedAt.localeCompare(a.queuedAt))
      .slice(0, limit);
  }

  async probeContactsArchiveColumn() {
    // The file store has no schema: the field is part of the record shape.
    return { ok: true as const };
  }

  async upsertSpeedNetworkingEntry(entry: SpeedNetworkingQueueEntry) {
    const snapshot = this.read();
    snapshot.speedNetworkingEntries = snapshot.speedNetworkingEntries.filter((item) => !(item.eventId === entry.eventId && item.attendeeId === entry.attendeeId));
    snapshot.speedNetworkingEntries.push(entry);
    this.write(snapshot);
    return entry;
  }

  async getSpeedNetworkingEntry(eventId: string, attendeeId: string) {
    return this.read().speedNetworkingEntries.find((item) => item.eventId === eventId && item.attendeeId === attendeeId);
  }

  async listSpeedNetworkingEntries(eventId: string) {
    return this.read().speedNetworkingEntries.filter((item) => item.eventId === eventId).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async upsertSpeedNetworkingMatch(match: SpeedNetworkingMatchRecord) {
    const snapshot = this.read();
    snapshot.speedNetworkingMatches = snapshot.speedNetworkingMatches.filter((item) => item.id !== match.id);
    snapshot.speedNetworkingMatches.push(match);
    this.write(snapshot);
    return match;
  }

  async getSpeedNetworkingMatch(eventId: string, matchId: string) {
    return this.read().speedNetworkingMatches.find((item) => item.eventId === eventId && item.id === matchId);
  }

  async listSpeedNetworkingMatches(eventId: string) {
    return this.read().speedNetworkingMatches.filter((item) => item.eventId === eventId).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  }

  async upsertRuntimeEvent(event: RuntimeEventRecord) {
    const snapshot = this.read();
    snapshot.runtimeEvents = snapshot.runtimeEvents.filter((item) => item.id !== event.id);
    snapshot.runtimeEvents.push(event);
    this.write(snapshot);
    return event;
  }

  async getRuntimeEvent(idOrSlugOrJoinCode: string) {
    const key = idOrSlugOrJoinCode.trim().toLowerCase();
    if (!key) return undefined;
    return this.read().runtimeEvents.find((item) => item.id.toLowerCase() === key || item.slug.toLowerCase() === key || item.joinCode.toLowerCase() === key);
  }

  async listRuntimeEvents() {
    return this.read().runtimeEvents.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async upsertRuntimeClient(client: RuntimeClientRecord) {
    const snapshot = this.read();
    snapshot.runtimeClients = snapshot.runtimeClients.filter((item) => item.id !== client.id);
    snapshot.runtimeClients.push(client);
    this.write(snapshot);
    return client;
  }

  async listRuntimeClients() {
    return this.read().runtimeClients.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAgencySettings(id: string) {
    return this.read().agencySettings.find((item) => item.id === id);
  }

  async setAgencySettings(settings: AgencySettingsRecord) {
    const snapshot = this.read();
    snapshot.agencySettings = snapshot.agencySettings.filter((item) => item.id !== settings.id);
    snapshot.agencySettings.push(settings);
    this.write(snapshot);
    return settings;
  }

  async readSnapshot() {
    return cloneSnapshot(this.read());
  }
}
