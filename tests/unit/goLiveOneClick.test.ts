import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Going live is one action: the event flips to live AND the producer ends up holding credentials.
 * The local Playwright run has placeholder LiveKit keys, so the credential half is proven here with
 * the provisioning call mocked — what matters is that Go live provisions when there is no key and
 * reuses what is there when there is.
 */
const provisioned: string[] = [];
vi.mock("@/services/video/livekitIngressService", () => ({
  provisionStreamYardLiveKitIngress: async (input: { eventId: string; stageId?: string }) => {
    provisioned.push(input.eventId);
    const { getRuntimeStore } = await import("@/services/runtime/runtimeStoreFactory");
    const { stageStreamKey, getOrCreateStageStreamState } = await import("@/services/video/stageStreamStateService");
    const current = await getOrCreateStageStreamState(input.eventId, input.stageId || "main-stage");
    await getRuntimeStore().setStageStreamState(stageStreamKey(input.eventId, input.stageId || "main-stage"), {
      ...current,
      livekitIngressId: `ing-${provisioned.length}`,
      livekitIngressUrl: "rtmps://livekit.example/live",
      livekitStreamKey: `key-${provisioned.length}`,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, eventId: input.eventId, stageId: input.stageId || "main-stage", roomName: "room", status: "READY_FOR_STREAMYARD" };
  },
  releaseIngressForEvent: async () => ({ released: true }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord } from "@/services/events/eventRepository";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";
import { createV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { goLiveAction, getStreamCredentialsAction } from "@/lib/actions/goLiveActions";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

async function signInAsOwner() {
  const env = getEnv();
  const { ownerCookieName } = getV5AccessCookieNames(env);
  jar.clear();
  jar.set(ownerCookieName, await createV5AccessCookie({ kind: "owner", role: "owner", issuedAt: Date.now(), expiresAt: Date.now() + 60_000 }, getV5AccessCookieSecret(env)));
}

describe("go live in one action", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    provisioned.length = 0;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-golive-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "One Click Room", when: "later" }, owner)).id;
    await signInAsOwner();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); jar.clear(); });

  it("flips the event live and provisions credentials in the same click", async () => {
    expect((await findEventRecord(eventId))?.status).toBe("draft");
    await goLiveAction(form({ eventId }));
    expect((await findEventRecord(eventId))?.status).toBe("live");
    const state = await getOperatorStageStreamState(eventId, "main-stage");
    expect(state.livekitStreamKey).toBe("key-1");
    expect(state.livekitIngressUrl).toBeTruthy();
    expect(provisioned).toEqual([eventId]);
  });

  it("a second Go live reuses the credentials it already has rather than minting a new key", async () => {
    await goLiveAction(form({ eventId }));
    await goLiveAction(form({ eventId }));
    expect(provisioned).toHaveLength(1);
    expect((await getOperatorStageStreamState(eventId, "main-stage")).livekitStreamKey).toBe("key-1");
  });

  it("\"New stream key\" always mints, because that is what it says", async () => {
    await goLiveAction(form({ eventId }));
    await getStreamCredentialsAction(form({ eventId }));
    expect(provisioned).toHaveLength(2);
    expect((await getOperatorStageStreamState(eventId, "main-stage")).livekitStreamKey).toBe("key-2");
  });

  it("the card is one component, rendered in all three places", () => {
    const card = fs.readFileSync("components/stage/GoLiveCard.tsx", "utf8");
    expect(card).toContain("goLiveAction");
    expect(card).toContain("StreamCredentials");
    expect(card).toContain("EndShowControl");
    for (const surface of ["app/app/events/[eventId]/publish/page.tsx", "components/owner/OwnerConsole.tsx", "components/moderation/CrewLiveModerationDeck.tsx"]) {
      expect(fs.readFileSync(surface, "utf8"), surface).toContain("GoLiveCard");
    }
    // The old jargon is gone.
    const credentials = fs.readFileSync("components/stage/StreamCredentials.tsx", "utf8");
    expect(credentials).toContain("Get stream credentials");
    expect(credentials).toContain("New stream key");
    expect(credentials).toContain("Copy both for StreamYard");
    expect(credentials).not.toContain("Generate / Refresh Primary RTMP");
  });
});
