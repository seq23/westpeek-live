import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GO LIVE WITH CAMERAS (23 Nov 2026): one source switch, "StreamYard" or "My camera", on the one
 * stage-live rule. The real reducer, store, guard and actions run here with real signed cookies;
 * only the two LiveKit network calls are stand-ins (local runs have no LiveKit), and each can be
 * made to fail.
 */
let roomResult: { ok: true } | { ok: false; reason: string } = { ok: true };
const roomCalls: string[] = [];
vi.mock("@/services/video/livekitIngressService", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/video/livekitIngressService")>();
  return {
    ...original,
    openLiveKitStageRoom: async (eventId: string) => { roomCalls.push(eventId); return roomResult; },
    provisionStreamYardLiveKitIngress: async (input: { eventId: string; stageId?: string }) => {
      const { getRuntimeStore } = await import("@/services/runtime/runtimeStoreFactory");
      const { stageStreamKey, getOrCreateStageStreamState } = await import("@/services/video/stageStreamStateService");
      const current = await getOrCreateStageStreamState(input.eventId, input.stageId || "main-stage");
      await getRuntimeStore().setStageStreamState(stageStreamKey(input.eventId, input.stageId || "main-stage"), { ...current, livekitIngressId: "ing-1", livekitIngressUrl: "rtmps://livekit.example/live", livekitStreamKey: "key-1", updatedAt: new Date().toISOString() });
      return { ok: true, eventId: input.eventId, stageId: input.stageId || "main-stage", roomName: "room", status: "READY_FOR_STREAMYARD" };
    },
    releaseIngressForEvent: async () => ({ released: true }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord } from "@/services/events/eventRepository";
import { revokeHostLinks } from "@/services/events/hostLinkService";
import { applyStageStreamSignal, getOperatorStageStreamState, getPublicStageStreamState } from "@/services/video/stageStreamStateService";
import { switchStageSource } from "@/services/video/stageSourceSwitch";
import { createV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { goLiveAction, switchStageSourceAction } from "@/lib/actions/goLiveActions";
import { applyStageStreamOperatorSignal, endTheShow } from "@/lib/actions/stageStreamActions";
import { stageIsLive, stageShowEnded, stageShowsPreStream, stageSourceLabel, CAMERA_SHOW_CLOUDFLARE_REASON } from "@/lib/video/stageLiveState";
import { livekitPlanFit } from "@/lib/capacity/capacityPlans";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import type { V4CrewRole } from "@/types/v4";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };
const form = (entries: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(entries)) data.set(k, v); return data; };

async function signIn(kind: "owner" | "crew", role?: V4CrewRole, eventId?: string, codeVersion?: number) {
  const env = getEnv();
  const names = getV5AccessCookieNames(env);
  jar.clear();
  const payload = kind === "owner" ? { kind: "owner" as const, role: "owner", issuedAt: Date.now(), expiresAt: Date.now() + 60_000 } : { kind: "crew" as const, role, eventId, codeVersion, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 };
  jar.set(kind === "owner" ? names.ownerCookieName : names.crewCookieName, await createV5AccessCookie(payload as never, getV5AccessCookieSecret(env)));
}
const stage = (eventId: string) => getOperatorStageStreamState(eventId, "main-stage");
const switchTo = (eventId: string, source: "CAMERAS" | "STREAMYARD") => switchStageSourceAction(null, form({ eventId, source }));

describe("go live with cameras", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    roomResult = { ok: true };
    roomCalls.length = 0;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-cameras-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "Camera Room", when: "later" }, owner)).id;
    await signIn("owner");
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); jar.clear(); });

  it("puts the stage live on cameras with no StreamYard feed, on the one stage-live rule, and the event reads live", async () => {
    const result = await switchTo(eventId, "CAMERAS");
    expect(result.ok).toBe(true);
    const state = await stage(eventId);
    expect(state.streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
    expect(state.stageSource).toBe("CAMERAS");
    expect(stageIsLive(state)).toBe(true);
    expect(stageShowsPreStream(state)).toBe(false);
    expect(stageSourceLabel(state)).toBe("Cameras");
    expect(stageSourceLabel(await getPublicStageStreamState(eventId, "main-stage"))).toBe("Cameras");
    expect((await findEventRecord(eventId))?.status).toBe("live");
  });

  it("never clears a StreamYard credential it did not mint, and a key minted mid camera show keeps the stage on cameras", async () => {
    await goLiveAction(form({ eventId }));
    await switchTo(eventId, "CAMERAS");
    expect((await stage(eventId)).livekitStreamKey).toBe("key-1");
    await applyStageStreamSignal({ eventId, signal: "generate_credentials" });
    const state = await stage(eventId);
    expect(state.streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
    expect(state.livekitStreamKey).toBeTruthy();
  });

  it("switches camera → StreamYard → camera mid-show: cameras hold the stage until the feed arrives, then the feed takes it", async () => {
    await switchTo(eventId, "CAMERAS");
    // A StreamYard feed still sending while the stage is on cameras does not take the stage.
    await applyStageStreamSignal({ eventId, signal: "ingress_started" });
    expect((await stage(eventId)).streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");

    const toFeed = await switchTo(eventId, "STREAMYARD");
    expect(toFeed.ok).toBe(true);
    expect(toFeed.message).toMatch(/Waiting for StreamYard/);
    let state = await stage(eventId);
    expect(state.streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
    expect(stageIsLive(state)).toBe(true);
    expect(stageSourceLabel(state)).toBe("Cameras · waiting for StreamYard…");
    // The feed arriving swaps it in.
    await applyStageStreamSignal({ eventId, signal: "ingress_started" });
    state = await stage(eventId);
    expect(state.streamStatus).toBe("LIVEKIT_INGRESS_LIVE");
    expect(stageSourceLabel(state)).toBe("StreamYard");

    const back = await switchTo(eventId, "CAMERAS");
    expect(back.ok).toBe(true);
    state = await stage(eventId);
    expect(state.streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
    expect(state.livekitStreamKey).toBe("key-1");
  });

  it("a StreamYard show whose feed dropped can go camera-only", async () => {
    await goLiveAction(form({ eventId }));
    await applyStageStreamSignal({ eventId, signal: "ingress_started" });
    await applyStageStreamSignal({ eventId, signal: "ingress_ended" });
    expect((await switchTo(eventId, "CAMERAS")).ok).toBe(true);
    expect((await stage(eventId)).streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
  });

  it("a double tap does not flip twice or open LiveKit twice", async () => {
    const [first, second] = [await switchTo(eventId, "CAMERAS"), await switchTo(eventId, "CAMERAS")];
    expect(first.ok && second.ok).toBe(true);
    expect(roomCalls).toHaveLength(1);
    const before = (await stage(eventId)).updatedAt;
    await switchTo(eventId, "CAMERAS");
    expect((await stage(eventId)).updatedAt).toBe(before);
  });

  it("LiveKit down: a plain reason, nothing goes live, the current source stays", async () => {
    roomResult = { ok: false, reason: "LiveKit did not answer just now, so the cameras cannot go out." };
    const result = await switchTo(eventId, "CAMERAS");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/LiveKit did not answer.*Nothing changed/);
    const state = await stage(eventId);
    expect(stageIsLive(state)).toBe(false);
    expect(state.stageSource).not.toBe("CAMERAS");
    expect((await findEventRecord(eventId))?.status).toBe("draft");

    // Mid StreamYard show: still StreamYard.
    roomResult = { ok: true };
    await goLiveAction(form({ eventId }));
    await applyStageStreamSignal({ eventId, signal: "ingress_started" });
    roomResult = { ok: false, reason: "LiveKit is not set up on this site, so the cameras cannot go out." };
    expect((await switchTo(eventId, "CAMERAS")).ok).toBe(false);
    expect((await stage(eventId)).streamStatus).toBe("LIVEKIT_INGRESS_LIVE");
  });

  it("an unreadable store refuses the switch, never reports it done", async () => {
    const store = getRuntimeStore();
    vi.spyOn(store, "getStageStreamState").mockRejectedValue(new Error("D1 down"));
    const result = await switchStageSource({ eventId, target: "CAMERAS", actorRole: "owner" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/could not be read|could not be saved/);
    vi.restoreAllMocks();
  });

  it("End show ends a camera show: late arrivals see ended, never pre-stream; then it can go live again", async () => {
    await switchTo(eventId, "CAMERAS");
    await endTheShow(form({ eventId }));
    let state = await getPublicStageStreamState(eventId, "main-stage");
    expect(stageShowEnded(state)).toBe(true);
    expect(stageShowsPreStream(state)).toBe(false);
    expect(stageSourceLabel(state)).toBe("Ended");
    expect((await findEventRecord(eventId))?.status).toBe("ended");
    expect((await switchTo(eventId, "CAMERAS")).ok).toBe(true);
    const restarted = await stage(eventId);
    expect(restarted.streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
    expect(restarted.operatorMarkedShowEnded).toBe(false);
  });

  it("LiveKit failing in a camera show moves to Daily, and moving back up returns to cameras", async () => {
    await switchTo(eventId, "CAMERAS");
    await applyStageStreamSignal({ eventId, signal: "livekit_room_unreachable" });
    let state = await stage(eventId);
    expect(state.streamStatus).toBe("SWITCHING_TO_DAILY");
    await applyStageStreamSignal({ eventId, signal: "operator_rollback_to_livekit" });
    state = await stage(eventId);
    expect(state.streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
  });

  it("Cloudflare Stream is refused in a camera show with the plain sentence; the generic form cannot switch the source", async () => {
    await switchTo(eventId, "CAMERAS");
    await expect(applyStageStreamOperatorSignal(form({ eventId, signal: "manual_switch_to_cloudflare_stream" }))).rejects.toThrow(CAMERA_SHOW_CLOUDFLARE_REASON);
    expect(CAMERA_SHOW_CLOUDFLARE_REASON).toMatch(/nothing to carry.*Daily/);
    await expect(applyStageStreamOperatorSignal(form({ eventId, signal: "operator_go_live_cameras" }))).rejects.toThrow(/Refused/);
    expect((await stage(eventId)).streamStatus).toBe("LIVEKIT_CAMERAS_LIVE");
  });

  it("nobody who may not go live can switch: no cookie, a moderator, a revoked crew link", async () => {
    jar.clear();
    expect((await switchTo(eventId, "CAMERAS")).ok).toBe(false);
    await signIn("crew", "moderator", eventId);
    expect((await switchTo(eventId, "CAMERAS")).ok).toBe(false);
    await revokeHostLinks(eventId, "owner");
    await signIn("crew", "technical_director", eventId, 0);
    const revoked = await switchTo(eventId, "CAMERAS");
    expect(revoked.ok).toBe(false);
    expect(roomCalls).toHaveLength(0);
    expect(stageIsLive(await stage(eventId))).toBe(false);
  });

  it("crew whose role may go live can, and the event reads live for everyone", async () => {
    await signIn("crew", "technical_director", eventId);
    expect((await switchTo(eventId, "CAMERAS")).ok).toBe(true);
    expect((await findEventRecord(eventId))?.status).toBe("live");
  });

  it("a camera show costs participant-minutes only: no transcode reason on the plan check", () => {
    const cameras = livekitPlanFit({ tier: "build", runMinutes: 90, expectedAudience: 20, cameras: true });
    const feed = livekitPlanFit({ tier: "build", runMinutes: 90, expectedAudience: 20 });
    expect(feed?.reasons.join(" ")).toMatch(/transcode/);
    expect(cameras).toBeNull();
    expect(livekitPlanFit({ tier: "build", runMinutes: 60, expectedAudience: 101, cameras: true })?.reasons.join(" ")).toMatch(/participant-minutes|refuses connection/);
  });
});
