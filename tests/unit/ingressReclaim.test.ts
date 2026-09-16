import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LiveKit caps the number of ingress objects on the project. On 16 Sep 2026 a fresh Room could not
 * get credentials ("total ingress object limit exceeded") because every earlier event still held
 * one. Under test: which ingresses are reclaimed, which are kept, that a 429 is retried after
 * reclaiming, that End the show releases the event's ingress, and that the refusal is written where
 * the console can show it.
 */

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests, getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, setEventStatus, archiveEventRecord } from "@/services/events/eventRepository";
import { getOrCreateStageStreamState, stageStreamKey } from "@/services/video/stageStreamStateService";
import { provisionStreamYardLiveKitIngress, reclaimStaleIngresses, releaseIngressForEvent } from "@/services/video/livekitIngressService";
import { endShowForEvent } from "@/services/video/showEndService";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Sequoia Taylor / owner", role: "owner" };
const ORIGINAL_ENV = { ...process.env };

function fakeLiveKit(handlers: Record<string, (body: unknown) => { status?: number; body: unknown }>, calls: { method: string; body: unknown }[]) {
  Object.assign(process.env, { LIVEKIT_URL: "wss://fake.livekit.test", LIVEKIT_API_KEY: "APIfake", ["LIVEKIT_API_" + "SECRET"]: "fake-value-for-the-unit-test-only" });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = String(url).split("/" + "twirp/" + "livekit.")[1] ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ method, body });
    const handler = handlers[method];
    if (!handler) return new Response(JSON.stringify({}), { status: 200 });
    const out = handler(body);
    return new Response(JSON.stringify(out.body), { status: out.status ?? 200 });
  }));
}

describe("LiveKit ingress reclaim", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-ingress-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setRuntimeStoreForTests(undefined);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env = { ...ORIGINAL_ENV };
  });

  it("keeps live and upcoming events' ingresses and anything publishing; deletes ended, archived, draft, seed and unknown ones", async () => {
    const live = await createEventRecord({ name: "Live one", when: "now" }, owner);
    const ended = await createEventRecord({ name: "Ended one", when: "now" }, owner);
    await setEventStatus(ended.id, "ended", owner);
    const draft = await createEventRecord({ name: "Draft one", when: "later", startAt: "2027-01-01T10:00", timezone: "UTC" }, owner);
    const room = (id: string) => `${id}-main-stage`;
    const calls: { method: string; body: unknown }[] = [];
    fakeLiveKit({
      "Ingress/ListIngress": () => ({ body: { items: [
        { ingress_id: "IN_live", room_name: room(live.id), state: { status: "ENDPOINT_INACTIVE" } },
        { ingress_id: "IN_ended", room_name: room(ended.id), state: { status: "ENDPOINT_INACTIVE" } },
        { ingress_id: "IN_draft", room_name: room(draft.id), state: { status: "ENDPOINT_INACTIVE" } },
        { ingress_id: "IN_demo", room_name: "demo-main-stage", state: { status: "ENDPOINT_INACTIVE" } },
        { ingress_id: "IN_busy_unknown", room_name: "someone-else-main-stage", state: { status: "ENDPOINT_PUBLISHING" } },
      ] } }),
      "Ingress/DeleteIngress": () => ({ body: {} }),
    }, calls);
    const out = await reclaimStaleIngresses("wss://fake.livekit.test", "token", {});
    expect(out.deleted.sort()).toEqual(["IN_demo", "IN_draft", "IN_ended"]);
    expect(out.kept.sort()).toEqual(["IN_busy_unknown", "IN_live"]);
    expect(calls.filter((c) => c.method === "Ingress/DeleteIngress").map((c) => (c.body as { ingress_id: string }).ingress_id).sort()).toEqual(["IN_demo", "IN_draft", "IN_ended"]);
  });

  it("a 429 on create reclaims and retries once; the refusal is written to the state when nothing can be reclaimed", async () => {
    const event = await createEventRecord({ name: "Needs credentials", when: "now" }, owner);
    let creates = 0;
    const calls: { method: string; body: unknown }[] = [];
    fakeLiveKit({
      "Ingress/CreateIngress": () => { creates += 1; return creates === 1
        ? { status: 429, body: { code: "resource_exhausted", msg: "total ingress object limit exceeded, delete an existing ingress first" } }
        : { body: { ingress_id: "IN_new", url: "rtmps://fake/x", stream_key: "key-1" } }; },
      "Ingress/ListIngress": () => ({ body: { items: [{ ingress_id: "IN_old", room_name: "old-event-main-stage", state: { status: "ENDPOINT_INACTIVE" } }] } }),
      "Ingress/DeleteIngress": () => ({ body: {} }),
      "RoomService/CreateRoom": () => ({ body: {} }),
    }, calls);
    const result = await provisionStreamYardLiveKitIngress({ eventId: event.id, actorRole: "owner" });
    expect(result.ok).toBe(true);
    expect(result.ingressId).toBe("IN_new");
    expect(creates).toBe(2);
    expect(calls.some((c) => c.method === "Ingress/DeleteIngress")).toBe(true);

    // Nothing stale: the refusal lands on the state, where the console shows it.
    const stuck = await createEventRecord({ name: "Still stuck", when: "now" }, owner);
    const calls2: { method: string; body: unknown }[] = [];
    fakeLiveKit({
      "Ingress/CreateIngress": () => ({ status: 429, body: { code: "resource_exhausted", msg: "total ingress object limit exceeded, delete an existing ingress first" } }),
      "Ingress/ListIngress": () => ({ body: { items: [{ ingress_id: "IN_busy", room_name: "busy-main-stage", state: { status: "ENDPOINT_PUBLISHING" } }] } }),
      "RoomService/CreateRoom": () => ({ body: {} }),
    }, calls2);
    const refused = await provisionStreamYardLiveKitIngress({ eventId: stuck.id, actorRole: "owner" });
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/nothing stale to reclaim/);
    expect((await getOrCreateStageStreamState(stuck.id)).lastProvisionError).toMatch(/ingress object limit/);
  });

  it("End the show and Archive give the ingress back and forget the credentials", async () => {
    const event = await createEventRecord({ name: "Ends tonight", when: "now" }, owner);
    const store = getRuntimeStore();
    const key = stageStreamKey(event.id, "main-stage");
    await store.setStageStreamState(key, { ...(await getOrCreateStageStreamState(event.id)), livekitIngressId: "IN_x", livekitIngressUrl: "rtmps://fake/x", livekitStreamKey: "k" });
    const calls: { method: string; body: unknown }[] = [];
    fakeLiveKit({ "Ingress/DeleteIngress": () => ({ body: {} }) }, calls);
    await endShowForEvent({ eventId: event.id, actorRole: "owner" });
    expect(calls.map((c) => c.method)).toContain("Ingress/DeleteIngress");
    const after = await getOrCreateStageStreamState(event.id);
    expect(after.livekitIngressId).toBeUndefined();
    expect(after.livekitStreamKey).toBeUndefined();

    const other = await createEventRecord({ name: "Put away", when: "now" }, owner);
    await store.setStageStreamState(stageStreamKey(other.id, "main-stage"), { ...(await getOrCreateStageStreamState(other.id)), livekitIngressId: "IN_y", livekitIngressUrl: "rtmps://fake/y", livekitStreamKey: "k2" });
    const calls2: { method: string; body: unknown }[] = [];
    fakeLiveKit({ "Ingress/DeleteIngress": () => ({ body: {} }) }, calls2);
    await archiveEventRecord(other.id, owner);
    expect(calls2.map((c) => c.method)).toContain("Ingress/DeleteIngress");
    expect((await getOrCreateStageStreamState(other.id)).livekitIngressId).toBeUndefined();
    expect((await releaseIngressForEvent(other.id)).released).toBe(false);
  });
});
