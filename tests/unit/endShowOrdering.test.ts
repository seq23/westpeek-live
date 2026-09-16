import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Intentional end vs dropped feed. When the ingress stops publishing the ladder steps down to
 * Daily — right for a dropped feed, wrong at the end of a show. Under test, in both orders:
 *   End the show → ingress_ended (webhook or polled reconcile) → ENDED, not Daily;
 *   event already `ended` (publish page) → ingress_ended → ENDED, not Daily;
 * and the control: a live event whose feed drops still fails over to Daily. The End-the-show
 * action is refused without a crew/operator/owner cookie.
 */

const control = vi.fn<(eventId?: string) => Promise<{ ok: true; actorRole: "crew" | "operator" | "owner" } | { ok: false; error: string }>>();
vi.mock("@/lib/auth/liveControlRequestGuard", () => ({ requireLiveEventControlAccessForRequest: (eventId?: string) => control(eventId) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord, setEventStatus } from "@/services/events/eventRepository";
import { applyStageStreamSignal, getOrCreateStageStreamState, stageStreamKey } from "@/services/video/stageStreamStateService";
import { reconcileIngressWithLiveKit } from "@/services/video/livekitIngressService";
import { endShowForEvent } from "@/services/video/showEndService";
import { endTheShow } from "@/lib/actions/stageStreamActions";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Sequoia Taylor / owner", role: "owner" };
const ORIGINAL_ENV = { ...process.env };
let counter = 0;

async function liveEvent(name: string) {
  const event = await createEventRecord({ name: `${name} ${Date.now()}-${counter += 1}`, when: "now" }, owner);
  await applyStageStreamSignal({ eventId: event.id, signal: "generate_credentials" });
  await applyStageStreamSignal({ eventId: event.id, signal: "ingress_started" });
  expect((await getOrCreateStageStreamState(event.id)).streamStatus).toBe("LIVEKIT_INGRESS_LIVE");
  return event;
}

/** Points the polled reconcile at a fake LiveKit that reports the ingress has stopped. */
function fakeLiveKitStopped(ingressId: string) {
  Object.assign(process.env, { LIVEKIT_URL: "wss://fake.livekit.test", LIVEKIT_API_KEY: "APIfake", ["LIVEKIT_API_" + "SECRET"]: "fake-value-for-the-unit-test-only" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ ingress_id: ingressId, state: { status: "ENDPOINT_INACTIVE" } }] }), { status: 200 })));
}

describe("End the show vs dropped feed", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-end-show-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    control.mockReset();
    control.mockResolvedValue({ ok: true, actorRole: "crew" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env = { ...ORIGINAL_ENV };
  });

  it("control: a live feed that drops without any end mark fails over to Daily", async () => {
    const event = await liveEvent("Dropped feed");
    const state = await applyStageStreamSignal({ eventId: event.id, signal: "ingress_ended", webhookEvent: "ingress_ended" });
    expect(state.activeStreamSource).toBe("DAILY");
    expect(state.streamStatus).toBe("SWITCHING_TO_DAILY");
  });

  it("order A: End the show first, then the webhook's ingress_ended → ENDED, event ended, no failover", async () => {
    const event = await liveEvent("Order A");
    const outcome = await endShowForEvent({ eventId: event.id, actorRole: "crew" });
    expect(outcome).toEqual({ stage: "ENDED", eventStatus: "ended" });
    expect((await findEventRecord(event.id))?.status).toBe("ended");
    const state = await applyStageStreamSignal({ eventId: event.id, signal: "ingress_ended", webhookEvent: "ingress_ended" });
    expect(state.streamStatus).toBe("ENDED");
    expect(state.activeStreamSource).toBe("LIVEKIT_INGRESS");
    expect(state.operatorMarkedShowEnded).toBe(true);
    expect(state.lastWebhookEvent).toBe("ingress_ended");
  });

  it("order B: the event is already ended (publish page) with no stage mark, then ingress_ended → ENDED, not Daily", async () => {
    const event = await liveEvent("Order B");
    await setEventStatus(event.id, "ended", owner);
    expect((await getOrCreateStageStreamState(event.id)).operatorMarkedShowEnded).toBe(false);
    const state = await applyStageStreamSignal({ eventId: event.id, signal: "ingress_ended", webhookEvent: "ingress_ended", reason: "LiveKit webhook reported StreamYard ingress ended." });
    expect(state.streamStatus).toBe("ENDED");
    expect(state.activeStreamSource).toBe("LIVEKIT_INGRESS");
    expect(state.operatorMarkedShowEnded).toBe(true);
    const log = (await getRuntimeStore().readSnapshot()).stageStreamEvents.filter((item) => item.eventId === event.id).at(-1);
    expect(log?.message).toMatch(/already ended, so this is the end of the show/);
  });

  it("the polled reconcile honours both orders too: an ended event whose ingress LiveKit reports stopped becomes ENDED", async () => {
    const event = await liveEvent("Polled");
    const key = stageStreamKey(event.id);
    const current = await getOrCreateStageStreamState(event.id);
    await getRuntimeStore().setStageStreamState(key, { ...current, livekitIngressId: "IN_fake" });
    await setEventStatus(event.id, "ended", owner);
    fakeLiveKitStopped("IN_fake");
    const result = await reconcileIngressWithLiveKit(event.id);
    expect(result).toMatchObject({ checked: true, publishing: false, applied: "ingress_ended" });
    const state = await getOrCreateStageStreamState(event.id);
    expect(state.streamStatus).toBe("ENDED");
    expect(state.activeStreamSource).toBe("LIVEKIT_INGRESS");
    expect(state.lastHealthCheckAt).toBeTruthy();
    // A polled ingress_ended must not be labelled as a webhook, or the console can never say "polling is carrying the state".
    expect(state.lastWebhookEvent).toBeUndefined();
  });

  it("the polled reconcile still fails a live event over to Daily when the feed really drops", async () => {
    const event = await liveEvent("Polled drop");
    const key = stageStreamKey(event.id);
    await getRuntimeStore().setStageStreamState(key, { ...(await getOrCreateStageStreamState(event.id)), livekitIngressId: "IN_drop" });
    fakeLiveKitStopped("IN_drop");
    expect((await reconcileIngressWithLiveKit(event.id)).applied).toBe("ingress_ended");
    expect((await getOrCreateStageStreamState(event.id)).activeStreamSource).toBe("DAILY");
  });

  it("End the show on a seed event marks the stage only, and a second press is idempotent", async () => {
    await applyStageStreamSignal({ eventId: "event-summit", signal: "ingress_started" });
    expect(await endShowForEvent({ eventId: "event-summit", actorRole: "owner" })).toEqual({ stage: "ENDED", eventStatus: "seed_unchanged" });
    const event = await liveEvent("Twice");
    expect((await endShowForEvent({ eventId: event.id, actorRole: "operator" })).eventStatus).toBe("ended");
    expect((await endShowForEvent({ eventId: event.id, actorRole: "operator" })).eventStatus).toBe("already_ended");
  });

  it("the End-the-show action is refused without a crew, operator, or owner cookie and changes nothing", async () => {
    const event = await liveEvent("Guarded");
    control.mockResolvedValue({ ok: false, error: "Owner, showrunner/operator, or crew access required." });
    const data = new FormData();
    data.set("eventId", event.id);
    await expect(endTheShow(data)).rejects.toThrow(/crew access required/);
    expect((await getOrCreateStageStreamState(event.id)).operatorMarkedShowEnded).toBe(false);
    expect((await findEventRecord(event.id))?.status).toBe("live");
    control.mockResolvedValue({ ok: true, actorRole: "owner" });
    await endTheShow(data);
    expect((await getOrCreateStageStreamState(event.id)).streamStatus).toBe("ENDED");
    expect((await findEventRecord(event.id))?.status).toBe("ended");
  });
});

describe("Go live after an ended show resets the stage", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-golive-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    control.mockReset();
    control.mockResolvedValue({ ok: true, actorRole: "owner" });
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env = { ...ORIGINAL_ENV };
  });
  it("an ended stage returns to ready when the event is taken live again, so the venue stops saying ended", async () => {
    const event = await liveEvent("Encore");
    await endShowForEvent({ eventId: event.id, actorRole: "owner" });
    expect((await getOrCreateStageStreamState(event.id)).streamStatus).toBe("ENDED");
    await setEventStatus(event.id, "live", owner);
    const stage = await getOrCreateStageStreamState(event.id);
    expect(stage.streamStatus).not.toBe("ENDED");
    expect(stage.operatorMarkedShowEnded).toBeFalsy();
    expect((await findEventRecord(event.id))?.status).toBe("live");
  });
});
