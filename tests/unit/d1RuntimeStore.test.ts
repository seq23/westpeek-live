import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@/lib/d1/query";
import { D1RuntimeStore } from "@/services/runtime/d1RuntimeStore";
import type { RuntimeStore } from "@/services/runtime/runtimeStore";
import { createTestD1 } from "./helpers/d1";

/**
 * The production store against a REAL D1 (Miniflare / workerd SQLite) built from migrations-d1/.
 * Every RuntimeStore method is called at least once and its result checked against what was written
 * (round trip, JSON and boolean columns included). The last test reads the RuntimeStore interface
 * out of services/runtime/runtimeStore.ts and fails if any declared method was never exercised here,
 * so a method added later cannot ship untested against D1.
 */
const T0 = "2026-10-06T10:00:00.000Z";
const T1 = "2026-10-06T10:05:00.000Z";
const T2 = "2026-10-06T10:10:00.000Z";
const EVENT = "evt-d1";

let env: Awaited<ReturnType<typeof createTestD1>>;
let store: RuntimeStore;
const called = new Set<string>();

beforeAll(async () => {
  env = await createTestD1();
  const real = new D1RuntimeStore(createDbClient(env.db));
  store = new Proxy(real, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        called.add(String(prop));
        return value.bind(target);
      }
      return value;
    },
  }) as RuntimeStore;
}, 60_000);

afterAll(async () => {
  await env?.dispose();
});

describe("D1RuntimeStore against migrations-d1 on a real D1", () => {
  it("identifies itself as the d1 store", () => {
    expect(store.kind).toBe("d1");
  });

  it("appends the audit and v5/v6 event logs and reads them back in the snapshot", async () => {
    await store.appendAuditLog({ id: "audit-1", agencyId: "west-peek", eventId: EVENT, actorUserId: "owner", actorRole: "owner", action: "event_created", resourceType: "event", resourceId: EVENT, visibility: "internal_agency", createdAt: T0 });
    await store.appendAccessAttempt({ id: "acc-1", status: "access_granted", accessKind: "owner", eventId: EVENT, role: "owner", route: "/app", createdAt: T0 });
    await store.appendAnalyticsEvent({ id: "an-1", eventId: EVENT, kind: "registration_completed", subjectId: "a1", metadata: { source: "test", n: 2 }, createdAt: T0 } as never);
    await store.appendFallbackEvent({ id: "fb-1", eventId: EVENT, roomId: "main", roomType: "stage", provider: "daily", action: "manual_switch", actorRole: "crew", reason: "drill", createdAt: T0 });
    await store.appendIncident({ id: "inc-1", eventId: EVENT, title: "Audio", severity: "high", status: "open", ownerRole: "crew", details: "hum", createdAt: T0 });
    await store.appendSupportRequest({ id: "sup-1", eventId: EVENT, attendeeId: "a1", subject: "Cannot hear", status: "open", createdAt: T0 });
    await store.appendEmailEvent({ id: "em-1", eventId: EVENT, templateKey: "reminder", recipientSegment: "all", status: "sent", providerMessageId: "re_1", createdAt: T0 });
    await store.appendRegistration({ id: "reg-1", eventId: EVENT, attendeeEmailHash: "h1", status: "confirmed", displayName: "Ada", socialLinks: ["https://x.example/ada"], createdAt: T0 });
    await store.appendRunOfShowEvent({ id: "ros-1", eventId: EVENT, segmentId: "seg-1", action: "mark_live", actorRole: "crew", createdAt: T0 });
    const snapshot = await store.readSnapshot();
    expect(snapshot.auditLogs).toEqual([expect.objectContaining({ id: "audit-1", agencyId: "west-peek", eventId: EVENT, action: "event_created" })]);
    expect(snapshot.accessAttempts[0]).toMatchObject({ id: "acc-1", accessKind: "owner", status: "access_granted" });
    expect(snapshot.analyticsEvents[0]).toMatchObject({ id: "an-1", metadata: { source: "test", n: 2 } });
    expect(snapshot.fallbackEvents[0]).toMatchObject({ id: "fb-1", provider: "daily", action: "manual_switch" });
    expect(snapshot.incidentEvents[0]).toMatchObject({ id: "inc-1", severity: "high" });
    expect(snapshot.supportRequests[0]).toMatchObject({ id: "sup-1", attendeeId: "a1" });
    expect(snapshot.emailEvents[0]).toMatchObject({ id: "em-1", providerMessageId: "re_1" });
    expect(snapshot.registrations[0]).toMatchObject({ id: "reg-1", socialLinks: ["https://x.example/ada"] });
    expect(snapshot.runOfShowEvents[0]).toMatchObject({ id: "ros-1", action: "mark_live" });
  });

  it("keeps fallback, stage-stream and live-control state as JSON keyed by event and room", async () => {
    const fallback = { eventId: EVENT, roomType: "stage", activeProvider: "daily", nested: { list: [1, 2] } } as never;
    await store.setFallbackState(`${EVENT}:stage`, fallback);
    expect(await store.getFallbackState(`${EVENT}:stage`)).toEqual(fallback);
    await store.setFallbackState(`${EVENT}:stage`, { ...(fallback as object), activeProvider: "zoom" } as never);
    expect(await store.getFallbackState(`${EVENT}:stage`)).toMatchObject({ activeProvider: "zoom" });

    const stage = { eventId: EVENT, stageId: "main-stage", streamStatus: "live", hasEverStarted: true } as never;
    await store.setStageStreamState(`${EVENT}:main-stage`, stage);
    expect(await store.getStageStreamState(`${EVENT}:main-stage`)).toEqual(stage);
    await store.appendStageStreamEvent({ id: "sse-1", eventId: EVENT, stageId: "main-stage", signal: "go_live", createdAt: T0 } as never);
    await store.appendStageStreamEvent({ id: "sse-2", eventId: EVENT, stageId: "main-stage", signal: "ended", createdAt: T1 } as never);
    expect((await store.listStageStreamEvents(EVENT, "main-stage", 1)).map((e) => e.id)).toEqual(["sse-2"]);

    const capability = { eventId: EVENT, attendeeId: "a1", roomKind: "stage", roomId: "main", canJoinLiveStream: true, canPublishCamera: false, canPublishMicrophone: false, canShareScreen: false, approvedForStage: false, revoked: false, updatedAt: T0 } as never;
    await store.setAttendeeLiveCapability(`${EVENT}:stage:main:a1`, capability);
    expect(await store.getAttendeeLiveCapability(`${EVENT}:stage:main:a1`)).toEqual(capability);
    expect(await store.listAttendeeLiveCapabilities(EVENT)).toEqual([capability]);
    const control = { eventId: EVENT, roomKind: "stage", roomId: "main", globalCameraEnabled: false, globalMicrophoneEnabled: true, globalScreenShareEnabled: false, requestRequired: true, attendeeJoinRequiresApproval: false, emergencyPublishingDisabled: false, updatedAt: T0 } as never;
    await store.setAttendeeLiveControlState(`${EVENT}:stage:main`, control);
    expect(await store.getAttendeeLiveControlState(`${EVENT}:stage:main`)).toEqual(control);
  });

  it("round-trips attendee profiles, sessions, intents, opt-ins and permissions", async () => {
    const profile = { attendeeId: "a1", eventId: EVENT, emailHash: "h1", email: "ada@westpeek.ventures", extraAnswers: { why: "learn" }, name: "Ada", emailMasked: "a***@westpeek.ventures", company: "WP", title: "CTO", socialLinks: ["https://x.example/ada"], topicsOfInterest: ["ai"], networkingOptIn: true, hiddenFromDirectory: false, role: "attendee", status: "active", createdAt: T0, updatedAt: T1 } as never;
    await store.upsertAttendeeProfile(profile);
    await store.upsertAttendeeProfile({ ...(profile as object), attendeeId: "a2", emailHash: "h2", email: undefined, name: "Bo", updatedAt: T0 } as never);
    expect(await store.getAttendeeProfile(EVENT, "a1")).toMatchObject({ attendeeId: "a1", extraAnswers: { why: "learn" }, socialLinks: ["https://x.example/ada"], networkingOptIn: true, hiddenFromDirectory: false });
    expect((await store.getAttendeeProfileByEmailHash(EVENT, "h2"))?.attendeeId).toBe("a2");
    expect((await store.listAttendeeProfiles(EVENT)).map((p) => p.attendeeId)).toEqual(["a1", "a2"]);
    expect((await store.listAttendeeProfilesByEmailHash("h1")).map((p) => p.attendeeId)).toEqual(["a1"]);
    expect((await store.listAttendeeProfilesWithoutEmail()).map((p) => p.attendeeId)).toEqual(["a2"]);

    const session = { sessionId: "s1", attendeeId: "a1", eventId: EVENT, role: "attendee", status: "active", issuedAt: T0, expiresAt: T2, lastSeenAt: T1, clientBuildId: "b1", clientSubscribedTracks: 2, clientSurface: "venue" } as never;
    await store.upsertAttendeeSession(session);
    await store.upsertAttendeeSession({ ...(session as object), sessionId: "s2", lastSeenAt: undefined } as never);
    expect(await store.getAttendeeSession(EVENT, "s1")).toMatchObject({ sessionId: "s1", clientBuildId: "b1", clientSubscribedTracks: 2 });
    // Postgres ordering kept: newest heartbeat first, a session that never beat last.
    expect((await store.listAttendeeSessions(EVENT)).map((s) => s.sessionId)).toEqual(["s1", "s2"]);

    const intent = { id: "int-1", attendeeId: "a1", eventId: EVENT, plannedSessionIds: ["x"], plannedBreakoutIds: [], plannedSponsorBoothIds: ["b"], wantsSessionReminders: true, updatedAt: T0 };
    await store.upsertAttendeeAgendaIntent(intent);
    expect(await store.getAttendeeAgendaIntent(EVENT, "a1")).toEqual(intent);
    await store.appendSponsorLeadOptIn({ id: "opt-1", attendeeId: "a1", eventId: EVENT, sponsorBoothId: "b", allowedFields: ["email"], createdAt: T0 } as never);
    const permission = { id: "perm-1", attendeeId: "a1", eventId: EVENT, permissionKind: "chat", granted: false, grantedBy: "crew", reason: "spam", updatedAt: T0 } as never;
    await store.upsertAttendeePermission(permission);
    expect(await store.listAttendeePermissions(EVENT, "a1")).toEqual([permission]);
    const snapshot = await store.readSnapshot();
    expect(snapshot.sponsorLeadOptIns[0]).toMatchObject({ id: "opt-1", allowedFields: ["email"] });
    expect(snapshot.attendeeProfiles).toHaveLength(2);
  });

  it("keeps contacts across events, including the archive column", async () => {
    const contact = { email: "ada@westpeek.ventures", name: "Ada", company: "WP", title: "CTO", socialLinks: [], topicsOfInterest: ["ai"], hiddenFromDirectory: true, eventsAttended: [EVENT], firstSeenAt: T0, lastSeenAt: T1, updatedAt: T1 } as never;
    await store.upsertContact(contact);
    await store.upsertContact({ ...(contact as object), archivedAt: T2 } as never);
    expect(await store.getContact("ada@westpeek.ventures")).toMatchObject({ hiddenFromDirectory: true, eventsAttended: [EVENT], archivedAt: T2 });
    expect(await store.listContacts()).toHaveLength(1);
    await expect(store.probeContactsArchiveColumn()).resolves.toEqual({ ok: true });
  });

  it("stores event assets and suppliers, and detaches a supplier for real", async () => {
    const asset = { id: "as-1", eventId: EVENT, fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: 1200, storagePath: `${EVENT}/as-1/deck.pdf`, uploadedByKind: "operator", uploadedByLabel: "Op", visibility: "internal", status: "uploaded", createdAt: T0, updatedAt: T0 } as never;
    await store.upsertEventAsset(asset);
    await store.upsertEventAsset({ ...(asset as object), id: "as-2", archivedAt: T1, createdAt: T1 } as never);
    expect(await store.getEventAsset("as-1")).toMatchObject({ storagePath: `${EVENT}/as-1/deck.pdf`, sizeBytes: 1200 });
    expect((await store.listEventAssets(EVENT)).map((a) => a.id)).toEqual(["as-1"]);
    expect((await store.listEventAssets(EVENT, true)).map((a) => a.id)).toEqual(["as-2", "as-1"]);
    expect(await store.listAllEventAssets()).toHaveLength(1);

    const supplier = { id: "sup-a", kind: "vendor", name: "Caption Co", company: "Caption Co", roleOrService: "Captioning", email: "c@westpeek.ventures", phone: "", rateKind: "flat_fee", rateAmount: 500, notes: "", status: "booked", createdAt: T0, updatedAt: T0 } as never;
    await store.upsertSupplier(supplier);
    expect(await store.getSupplier("sup-a")).toMatchObject({ rateAmount: 500, status: "booked" });
    expect(await store.listSuppliers()).toHaveLength(1);
    await store.upsertSupplierEventLink({ id: "lnk-1", supplierId: "sup-a", eventId: EVENT, note: "hall B", createdAt: T0 });
    // supplier_id + event_id is unique: attaching twice updates the one link (every column, as the Postgres upsert did).
    await store.upsertSupplierEventLink({ id: "lnk-2", supplierId: "sup-a", eventId: EVENT, note: "hall C", createdAt: T1 });
    expect(await store.listSupplierEventLinks()).toEqual([expect.objectContaining({ id: "lnk-2", supplierId: "sup-a", note: "hall C" })]);
    await store.deleteSupplierEventLink("sup-a", EVENT);
    expect(await store.listSupplierEventLinks()).toEqual([]);
  });

  it("logs email sends, group sends and the unsubscribe list", async () => {
    await store.appendEmailSendLog({ id: "es-1", eventId: EVENT, workflowType: "reminder", recipientEmail: "ada@westpeek.ventures", subject: "Hi", provider: "resend", status: "sent", queuedAt: T0, sentAt: T1, sentBy: "owner" } as never);
    await store.appendEmailSendLog({ id: "es-2", workflowType: "reminder", recipientEmail: "bo@westpeek.ventures", subject: "Hi", provider: "resend", status: "failed", queuedAt: T1, failureReason: "bounce" } as never);
    expect((await store.listEmailSendLogs(EVENT)).map((l) => l.id)).toEqual(["es-1"]);
    expect((await store.listAllEmailSendLogs()).map((l) => l.id)).toEqual(["es-2", "es-1"]);
    await store.appendEmailGroupSend({ id: "gs-1", eventId: EVENT, audience: "registered", audienceLabel: "Registered", workflowType: "reminder", subject: "Hi", recipientCount: 2, sentCount: 1, failedCount: 1, suppressedCount: 0, createdAt: T0 } as never);
    expect((await store.listEmailGroupSends())[0]).toMatchObject({ id: "gs-1", recipientCount: 2 });
    await store.upsertEmailUnsubscribe({ email: "bo@westpeek.ventures", emailHash: "hb", unsubscribedAt: T0, unsubscribedSource: "one_click" } as never);
    expect(await store.getEmailUnsubscribe("bo@westpeek.ventures")).toMatchObject({ emailHash: "hb" });
    expect(await store.listEmailUnsubscribes()).toHaveLength(1);
  });

  it("saves, lists and deletes event templates", async () => {
    const template = { id: "tpl-1", name: "Webinar", description: "", format: "stage", eventType: "webinar", durationMinutes: 45, sessions: [{ title: "Intro", minutes: 5 }], registrationQuestions: ["Why?"], createdByLabel: "Owner", createdAt: T0, updatedAt: T0 } as never;
    await store.upsertEventTemplate(template);
    expect(await store.getEventTemplate("tpl-1")).toEqual(template);
    expect(await store.listEventTemplates()).toHaveLength(1);
    await store.deleteEventTemplate("tpl-1");
    expect(await store.getEventTemplate("tpl-1")).toBeUndefined();
  });

  it("keeps backup rooms and superseded codes", async () => {
    await store.setEventBackupRoom({ eventId: EVENT, stageId: "main-stage", zoomMeetingNumber: "123", googleMeetUrl: "https://meet.google.com/abc-defg-hij", updatedBy: "crew", updatedAt: T0 });
    expect(await store.getEventBackupRoom(EVENT, "main-stage")).toMatchObject({ zoomMeetingNumber: "123" });
    await store.appendSupersededCode({ id: "sc-1", eventId: EVENT, field: "join", code: "WPL-OLD", codeKey: "wplold", replacedAt: T0, reason: "rotate" } as never);
    await store.appendSupersededCode({ id: "sc-2", eventId: EVENT, field: "join", code: "WPL-OLD", codeKey: "wplold", replacedAt: T1, reason: "rotate" } as never);
    expect((await store.findSupersededCode("wplold"))?.id).toBe("sc-2");
    expect((await store.listSupersededCodes(EVENT)).map((c) => c.id)).toEqual(["sc-2", "sc-1"]);
  });

  it("runs live chat: post, moderate, delta-poll, clear, rate and moderation state", async () => {
    await store.appendLiveChatMessage({ id: "m1", eventId: EVENT, roomKind: "main_stage" as never, roomId: "main", attendeeId: "a1", displayName: "Ada", message: "hello", moderationStatus: "visible", createdAt: T0 });
    await store.appendLiveChatMessage({ id: "m2", eventId: EVENT, roomKind: "main_stage" as never, roomId: "main", attendeeId: "a2", displayName: "Bo", message: "spam", moderationStatus: "visible", createdAt: T1 });
    const hidden = await store.updateLiveChatMessageModeration({ id: "m2", eventId: EVENT, moderationStatus: "hidden", moderatedBy: "crew", moderatedAt: T2 });
    expect(hidden).toMatchObject({ id: "m2", moderationStatus: "hidden", moderatedBy: "crew" });
    expect((await store.listLiveChatMessages(EVENT, "main_stage", "main")).map((m) => m.id)).toEqual(["m1"]);
    expect((await store.listLiveChatMessages(EVENT, "main_stage", "main", { includeHidden: true })).map((m) => m.id)).toEqual(["m1", "m2"]);
    // The delta poll sees the hide (moderated_at after T1) though m2 was created at T1.
    expect((await store.listLiveChatMessagesSince(EVENT, "main_stage", "main", T1)).map((m) => m.id)).toEqual(["m2"]);
    expect((await store.listRecentLiveChatMessages(EVENT, 1)).map((m) => m.id)).toEqual(["m2"]);
    expect(await store.archiveLiveChatRoomMessages({ eventId: EVENT, roomKind: "main_stage", roomId: "main", archivedAt: T2, archivedBy: "crew" })).toBe(2);
    expect(await store.listLiveChatMessages(EVENT, "main_stage", "main", { includeHidden: true })).toEqual([]);

    const rate = { key: `${EVENT}:a1`, eventId: EVENT, attendeeId: "a1", recent: [T0], updatedAt: T0 } as never;
    await store.setLiveChatRateState(rate);
    expect(await store.getLiveChatRateState(`${EVENT}:a1`)).toEqual(rate);
    const moderation = { key: `${EVENT}:stage:main`, eventId: EVENT, roomKind: "stage", roomId: "main", scope: "room", locked: true, silenced: false, updatedBy: "crew", updatedAt: T0 } as never;
    await store.setLiveChatModerationState(moderation);
    expect(await store.getLiveChatModerationState(`${EVENT}:stage:main`)).toEqual(moderation);
    expect(await store.listLiveChatModerationStates(EVENT)).toEqual([moderation]);
  });

  it("keeps special guests and their event-scoped state", async () => {
    await store.upsertSpecialGuestProfile({ guestId: "g1", eventId: EVENT, role: "speaker", name: "Cy", company: "X", title: "Y", email: "cy@westpeek.ventures", createdAt: T0, updatedAt: T0 });
    await store.upsertSpecialGuestProfile({ guestId: "g2", eventId: EVENT, role: "sponsor", name: "Di", company: "X", title: "Y", createdAt: T1, updatedAt: T1 });
    expect(await store.getSpecialGuestProfile(EVENT, "g1")).toMatchObject({ email: "cy@westpeek.ventures" });
    expect((await store.listSpecialGuestProfiles(EVENT, "sponsor")).map((g) => g.guestId)).toEqual(["g2"]);
    await store.setEventGuestState({ key: `${EVENT}:speaker_stage:g1`, eventId: EVENT, kind: "speaker_stage", guestId: "g1", state: { status: "on_stage" }, updatedAt: T0 } as never);
    expect(await store.getEventGuestState(`${EVENT}:speaker_stage:g1`)).toMatchObject({ state: { status: "on_stage" } });
    expect(await store.listEventGuestStates(EVENT, "speaker_stage")).toHaveLength(1);
  });

  it("runs the speed-networking queue and matches", async () => {
    await store.upsertSpeedNetworkingEntry({ id: "q1", eventId: EVENT, attendeeId: "a1", displayName: "Ada", company: "", title: "", status: "waiting", joinedAt: T0, matchesCompleted: 0, updatedAt: T0 });
    expect(await store.getSpeedNetworkingEntry(EVENT, "a1")).toMatchObject({ status: "waiting" });
    expect(await store.listSpeedNetworkingEntries(EVENT)).toHaveLength(1);
    await store.upsertSpeedNetworkingMatch({ id: "mt1", eventId: EVENT, attendeeAId: "a1", attendeeBId: "a2", normalizedPairKey: "a1:a2", roomName: "r1", status: "active", startsAt: T0, expiresAt: T1 });
    expect(await store.getSpeedNetworkingMatch(EVENT, "mt1")).toMatchObject({ normalizedPairKey: "a1:a2" });
    expect(await store.listSpeedNetworkingMatches(EVENT)).toHaveLength(1);
  });

  it("creates runtime events and clients, and finds an event by id, slug or join code", async () => {
    const event = { id: "evt-rt", slug: "summit-rt", name: "Summit", format: "stage", eventType: "webinar", status: "draft", clientName: "West Peek", clientSlug: "west-peek", startAt: T0, endAt: T2, timezone: "America/Chicago", joinCode: "wpl-abc123", accessCodes: { crew: "c", speaker: "s", sponsor: "p", vip: "v", client: "k" }, registrationEnabled: true, registrationQuestions: [{ id: "q", label: "Why?" }], attendeeSessionDays: 3, branding: { color: "#000" }, sessions: [{ id: "s1", title: "Open" }], source: "runtime", createdBy: "owner", createdByLabel: "Owner", createdAt: T0, updatedAt: T0 } as never;
    await store.upsertRuntimeEvent(event);
    for (const key of ["evt-rt", "summit-rt", "wpl-abc123", "WPL-ABC123"]) expect((await store.getRuntimeEvent(key))?.id).toBe("evt-rt");
    expect(await store.getRuntimeEvent("nope")).toBeUndefined();
    // The or() filter never takes raw input: a value with a comma or operator is refused before SQL.
    expect(await store.getRuntimeEvent("x,id.neq.y")).toBeUndefined();
    expect((await store.getRuntimeEvent("evt-rt"))).toMatchObject({ registrationEnabled: true, branding: { color: "#000" }, attendeeSessionDays: 3 });
    expect(await store.listRuntimeEvents()).toHaveLength(1);
    await store.upsertRuntimeClient({ id: "cl-1", slug: "acme", name: "Acme", status: "active", createdBy: "owner", createdByLabel: "Owner", createdAt: T0, updatedAt: T0 });
    expect((await store.listRuntimeClients()).map((c) => c.id)).toEqual(["cl-1"]);
  });

  it("keeps agency settings, house defaults, event requests and how-it-works pages", async () => {
    const settings = { id: "west-peek", agencyName: "West Peek", primaryColor: "#111", accentColor: "#f60", members: [{ name: "A", email: "a@westpeek.ventures", role: "owner" }], updatedBy: "owner", updatedByLabel: "Owner", updatedAt: T0 } as never;
    await store.setAgencySettings(settings);
    expect(await store.getAgencySettings("west-peek")).toEqual(settings);
    const house = { id: "west-peek", fromEmail: "events@westpeek.live", replyToEmail: "hello@westpeek.live", logoStoragePath: "house/logo/l1/logo.png", logoFileName: "logo.png", defaultTimezone: "America/Chicago", defaultNetworkingMatchMinutes: 5, defaultAttendeeSessionDays: 3, defaultRegistrationQuestions: [{ id: "q", label: "Why?" }], livekitTier: "ship", starterTemplatesInstalledAt: T0, updatedBy: "owner", updatedByLabel: "Owner", updatedAt: T0 } as never;
    await store.setHouseDefaults(house);
    expect(await store.getHouseDefaults("west-peek")).toEqual(house);

    const request = { id: "req-1", name: "TEST ROW", email: "test@westpeek.ventures", company: "Test", state: "requested", confirmToken: "tok-1", priceAmountCents: 125000, createdAt: T0, updatedAt: T0 } as never;
    await store.upsertEventRequest(request);
    expect(await store.getEventRequest("req-1")).toMatchObject({ name: "TEST ROW", priceAmountCents: 125000 });
    expect((await store.getEventRequestByConfirmToken("tok-1"))?.id).toBe("req-1");
    expect(await store.getEventRequestByConfirmToken("")).toBeUndefined();
    expect(await store.listEventRequests()).toHaveLength(1);

    const page = { slug: "attendee", title: "How it works", intro: "Hi", body: "Body", updatedBy: "owner", updatedByLabel: "Owner", updatedAt: T0 } as never;
    await store.setHowItWorksPage(page);
    expect(await store.getHowItWorksPage("attendee" as never)).toEqual(page);
    expect(await store.listHowItWorksPages()).toEqual([page]);
  });

  it("surfaces a missing table as RuntimeSchemaMissingError by name, never as an empty list", async () => {
    const bare = await createTestD1({ migrate: false });
    try {
      const empty = new D1RuntimeStore(createDbClient(bare.db));
      await expect(empty.listRuntimeEvents()).rejects.toMatchObject({ name: "RuntimeSchemaMissingError", table: "runtime_events" });
      await expect(empty.appendAuditLog({ id: "x", agencyId: "a", actorUserId: "u", actorRole: "r", action: "a", resourceType: "t", resourceId: "i", visibility: "internal_agency", createdAt: T0 })).rejects.toThrow(/D1 runtime store failed: audit_logs/);
    } finally {
      await bare.dispose();
    }
  }, 30_000);

  it("exercised every method the RuntimeStore interface declares", () => {
    const source = fs.readFileSync("services/runtime/runtimeStore.ts", "utf8");
    const body = source.slice(source.indexOf("export interface RuntimeStore {"), source.indexOf("export function emptyRuntimeSnapshot"));
    const declared = Array.from(body.matchAll(/^\s{2}([a-zA-Z]+)\(/gm)).map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(80);
    expect(declared.filter((name) => !called.has(name))).toEqual([]);
  });
});
