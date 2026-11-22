import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real server actions, with a real signed crew cookie in the jar, refused or allowed BY ROLE
 * through the real guard (nothing mocked between the action and the permission map):
 *   moderator → End the show: refused with the deck's sentence; the show stays on.
 *   technical director → End the show: the stage is ENDED and the event `ended`.
 *   moderator → hide a chat message: allowed. technical director → lock chat: refused.
 *   producer → bring a speaker to the stage: allowed. support → refused.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));
vi.mock("@/services/video/livekitParticipantAdmin", () => ({ removeLiveKitParticipantFromMainStage: async () => ({ status: "removed" }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord } from "@/services/events/eventRepository";
import { applyStageStreamSignal, getOrCreateStageStreamState } from "@/services/video/stageStreamStateService";
import { createV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { endTheShow, generateStreamYardCredentials } from "@/lib/actions/stageStreamActions";
import { lockLiveChatRoom, moderateLiveChatMessage } from "@/lib/actions/liveChatActions";
import { bringSpeakerToStageAction } from "@/lib/actions/speakerStageActions";
import { runVideoHealthCheckAction, switchRoomFallbackAction } from "@/lib/actions/videoFallbackActions";
import { authorizeVideoTokenRequest } from "@/lib/auth/videoTokenRequestGuard";
import { getRoomFallbackState } from "@/services/video/roomFallbackService";
import { revokeHostLinks } from "@/services/events/hostLinkService";
import { authorizeLiveControl } from "@/lib/auth/liveControlRequestGuard";
import { canViewAsGuest } from "@/lib/auth/viewAsGuard";
import { getSpeakerStageState } from "@/services/guests/guestStateService";
import { postLiveRoomChatMessage } from "@/services/venue/liveChatService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import type { V4CrewRole } from "@/types/v4";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

async function signInAsCrew(role: V4CrewRole, eventId: string, codeVersion?: number) {
  const env = getEnv();
  const { crewCookieName } = getV5AccessCookieNames(env);
  jar.clear();
  jar.set(crewCookieName, await createV5AccessCookie({ kind: "crew", role, eventId, codeVersion, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 }, getV5AccessCookieSecret(env)));
}

describe("crew server actions by role", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-roles-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    const event = await createEventRecord({ name: `Roles ${Date.now()}`, when: "now" }, owner);
    eventId = event.id;
    await applyStageStreamSignal({ eventId, signal: "generate_credentials" });
    await applyStageStreamSignal({ eventId, signal: "ingress_started" });
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
    jar.clear();
  });

  it("moderator cannot end the show or generate credentials; the technical director can", async () => {
    await signInAsCrew("moderator", eventId);
    await expect(endTheShow(form({ eventId }))).rejects.toThrow("Moderator can't move the stream or end the show — that's the Executive Producer, a producer, or the Technical Director.");
    await expect(generateStreamYardCredentials(form({ eventId }))).rejects.toThrow(/Moderator can't move the stream/);
    expect((await getOrCreateStageStreamState(eventId)).streamStatus).toBe("LIVEKIT_INGRESS_LIVE");
    expect((await findEventRecord(eventId))?.status).toBe("live");

    await signInAsCrew("technical_director", eventId);
    await endTheShow(form({ eventId }));
    expect((await getOrCreateStageStreamState(eventId)).operatorMarkedShowEnded).toBe(true);
    expect((await findEventRecord(eventId))?.status).toBe("ended");
  });

  it("moderator can hide chat; the technical director cannot lock it", async () => {
    const posted = await postLiveRoomChatMessage({ eventId, roomKind: "main_stage", roomId: "main-stage", attendeeId: "att-1", displayName: "Sam", company: "Co", message: "hello" });
    expect(posted.ok).toBe(true);
    const message = (await getRuntimeStore().listRecentLiveChatMessages(eventId, 5))[0];
    await signInAsCrew("technical_director", eventId);
    await expect(lockLiveChatRoom(form({ eventId, roomKind: "main_stage", roomId: "main-stage", locked: "true" }))).rejects.toThrow(/Technical Director can't moderate chat/);
    await signInAsCrew("moderator", eventId);
    await moderateLiveChatMessage(form({ eventId, messageId: message.id, roomKind: "main_stage", roomId: "main-stage", action: "hide" }));
    expect((await getRuntimeStore().listRecentLiveChatMessages(eventId, 5))[0].moderationStatus).toBe("hidden");
  });

  it("producer can bring a speaker to the stage; support and plain crew cannot", async () => {
    await signInAsCrew("support", eventId);
    await expect(bringSpeakerToStageAction(form({ eventId, speakerId: "speaker-1" }))).rejects.toThrow(/Support can't change who is on the stage/);
    await signInAsCrew("crew", eventId);
    await expect(bringSpeakerToStageAction(form({ eventId, speakerId: "speaker-1" }))).rejects.toThrow(/Crew can't change who is on the stage/);
    expect((await getSpeakerStageState(eventId, "speaker-1")).status).toBe("backstage");
    await signInAsCrew("producer", eventId);
    await bringSpeakerToStageAction(form({ eventId, speakerId: "speaker-1" }));
    expect((await getSpeakerStageState(eventId, "speaker-1")).status).toBe("invited");
  });

  it("a crew cookie for another event is refused regardless of role", async () => {
    await signInAsCrew("executive_producer", "some-other-event");
    await expect(endTheShow(form({ eventId }))).rejects.toThrow(/Owner, showrunner\/operator, or crew access required/);
  });

  it("video fallback: a current technical director may switch it; one whose link was revoked may not, and nothing changes", async () => {
    await signInAsCrew("technical_director", eventId, 0);
    await switchRoomFallbackAction(form({ eventId, roomType: "main_stage", provider: "daily" }));
    const switched = await getRoomFallbackState(eventId, "main_stage");
    expect(switched.activeProvider).toBe("daily");

    await revokeHostLinks(eventId, "owner");
    await expect(switchRoomFallbackAction(form({ eventId, roomType: "main_stage", provider: "livekit" }))).rejects.toThrow();
    expect((await getRoomFallbackState(eventId, "main_stage")).activeProvider).toBe("daily");
  });

  it("video fallback: a crew cookie for another event, or a role without it, is refused", async () => {
    await signInAsCrew("technical_director", "some-other-event", 0);
    await expect(switchRoomFallbackAction(form({ eventId, roomType: "main_stage", provider: "daily" }))).rejects.toThrow();
    await signInAsCrew("moderator", eventId, 0);
    await expect(switchRoomFallbackAction(form({ eventId, roomType: "main_stage", provider: "daily" }))).rejects.toThrow(/Moderator can't switch the video fallback/);
  });
});

async function signInAsOperator(eventId?: string) {
  const env = getEnv();
  const { operatorCookieName } = getV5AccessCookieNames(env);
  jar.clear();
  jar.set(operatorCookieName, await createV5AccessCookie({ kind: "operator", eventId, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 }, getV5AccessCookieSecret(env)));
}

describe("host and producer video tokens follow the live-control rule (they make the holder a room owner)", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-video-token-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: `Tokens ${Date.now()}`, when: "now" }, owner)).id;
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
    jar.clear();
  });

  it("crew whose link was revoked gets no host or producer token", async () => {
    await signInAsCrew("executive_producer", eventId, 0);
    expect((await authorizeVideoTokenRequest({ role: "host", eventId })).ok).toBe(true);
    await revokeHostLinks(eventId, "owner");
    for (const role of ["host", "producer"] as const) {
      const refused = await authorizeVideoTokenRequest({ role, eventId });
      expect(refused).toMatchObject({ ok: false, error: expect.stringMatching(/revoked/) });
    }
  });

  it("an operator scoped to one event gets no host token for another event", async () => {
    await signInAsOperator("some-other-event");
    for (const role of ["host", "producer", "speaker"] as const) expect((await authorizeVideoTokenRequest({ role, eventId })).ok).toBe(false);
    await signInAsOperator(eventId);
    expect((await authorizeVideoTokenRequest({ role: "host", eventId })).ok).toBe(true);
  });

  it("crew for another event gets no host token", async () => {
    await signInAsCrew("executive_producer", "some-other-event", 0);
    expect((await authorizeVideoTokenRequest({ role: "host", eventId })).ok).toBe(false);
  });
});

describe("the video fallback audit names who really pressed it", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-fallback-audit-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: `Audit ${Date.now()}`, when: "now" }, owner)).id;
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
    jar.clear();
    vi.restoreAllMocks();
  });

  it("an executive producer's switch is logged as executive_producer; an operator's health check as operator", async () => {
    const audit = vi.spyOn(getRuntimeStore(), "appendFallbackEvent");
    await signInAsCrew("executive_producer", eventId, 0);
    await switchRoomFallbackAction(form({ eventId, roomType: "main_stage", provider: "daily" }));
    await signInAsOperator(eventId);
    await runVideoHealthCheckAction(form({ eventId, roomType: "main_stage" }));
    expect(audit.mock.calls.map(([event]) => event.actorRole)).toEqual(["executive_producer", "operator"]);
  });
});

describe("one rule for the crew role: an old executive producer cookie with no event or code version is plain crew everywhere", () => {
  const now = Date.now();
  const unscoped = { kind: "crew" as const, role: "executive_producer" as const, issuedAt: now, expiresAt: now + 60_000 };
  const unversioned = { ...unscoped, eventId: "event-a" };
  const host = { ...unscoped, eventId: "event-a", codeVersion: 0 };

  it("video fallback actions", () => {
    expect(authorizeLiveControl({ crew: unscoped }, "event-a", "switch_video_fallback").ok).toBe(false);
    expect(authorizeLiveControl({ crew: unversioned }, "event-a", "switch_video_fallback").ok).toBe(false);
    expect(authorizeLiveControl({ crew: host }, "event-a", "switch_video_fallback").ok).toBe(true);
  });

  it("previewing a guest's pages (?viewAs=)", () => {
    expect(canViewAsGuest({ crew: unscoped }, "event-a")).toEqual({ ok: false });
    expect(canViewAsGuest({ crew: unversioned }, "event-a")).toEqual({ ok: false });
    expect(canViewAsGuest({ crew: host }, "event-a")).toMatchObject({ ok: true, label: "the executive producer" });
  });
});
