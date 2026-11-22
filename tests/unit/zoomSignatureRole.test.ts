import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Zoom role 1 makes the holder the meeting's host. The real route, with real signed cookies in the
 * jar: the Zoom role in the signed JWT comes from who is asking, never from what the client sends.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { revokeHostLinks } from "@/services/events/hostLinkService";
import { createV5AccessCookie, type V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { POST } from "@/app/api/video/zoom-signature/route";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

async function signIn(cookie: "crew" | "operator", payload: Record<string, unknown>) {
  const env = getEnv();
  const names = getV5AccessCookieNames(env);
  jar.clear();
  jar.set(cookie === "crew" ? names.crewCookieName : names.operatorCookieName, await createV5AccessCookie({ ...payload, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 } as V5AccessCookiePayload, getV5AccessCookieSecret(env)));
}

/** Calls the route; returns the HTTP status and the role inside the signed JWT (undefined when refused). */
async function ask(eventId: string, body: Record<string, unknown>) {
  const response = await POST(new Request("http://local/api/video/zoom-signature", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, meetingNumber: "123456789", ...body }) }));
  const json = (await response.json()) as { result?: { signature: string } };
  const signedRole = json.result ? JSON.parse(Buffer.from(json.result.signature.split(".")[1], "base64url").toString()).role : undefined;
  return { status: response.status, signedRole };
}

describe("Zoom signature: the host role is signed only through the live-control rule", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    process.env.ZOOM_MEETING_SDK_KEY = "test-key";
    process.env.ZOOM_MEETING_SDK_SECRET = "test-secret";
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-zoom-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: `Zoom ${Date.now()}`, when: "now" }, owner)).id;
    jar.clear();
  });
  afterEach(() => {
    delete process.env.ZOOM_MEETING_SDK_KEY;
    delete process.env.ZOOM_MEETING_SDK_SECRET;
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
    jar.clear();
  });

  it("no cookie: an observer is signed role 0, and asking for role 1 is refused", async () => {
    expect(await ask(eventId, { zoomRole: 0, videoRole: "observer" })).toEqual({ status: 200, signedRole: 0 });
    expect(await ask(eventId, { zoomRole: 1, videoRole: "observer" })).toEqual({ status: 403, signedRole: undefined });
    expect(await ask(eventId, { zoomRole: 1 })).toEqual({ status: 403, signedRole: undefined });
    expect(await ask(eventId, { role: 1, videoRole: "observer" })).toEqual({ status: 403, signedRole: undefined });
  });

  it("crew whose link was revoked is refused the host role", async () => {
    await signIn("crew", { kind: "crew", role: "executive_producer", eventId, codeVersion: 0 });
    expect(await ask(eventId, { zoomRole: 1, videoRole: "producer" })).toEqual({ status: 200, signedRole: 1 });
    await revokeHostLinks(eventId, "owner");
    expect(await ask(eventId, { zoomRole: 1, videoRole: "producer" })).toEqual({ status: 403, signedRole: undefined });
    expect(await ask(eventId, { zoomRole: 1, videoRole: "observer" })).toEqual({ status: 403, signedRole: undefined });
  });

  it("an operator for another event is refused the host role; one for this event gets it", async () => {
    await signIn("operator", { kind: "operator", eventId: "some-other-event" });
    expect(await ask(eventId, { zoomRole: 1, videoRole: "host" })).toEqual({ status: 403, signedRole: undefined });
    await signIn("operator", { kind: "operator", eventId });
    expect(await ask(eventId, { zoomRole: 1, videoRole: "host" })).toEqual({ status: 200, signedRole: 1 });
  });

  it("a real producer gets role 1; a producer who asks for role 0 as an attendee still gets 0", async () => {
    await signIn("crew", { kind: "crew", role: "producer", eventId, codeVersion: 0 });
    expect(await ask(eventId, { zoomRole: 1, videoRole: "producer" })).toEqual({ status: 200, signedRole: 1 });
    expect(await ask(eventId, { zoomRole: 0, videoRole: "observer" })).toEqual({ status: 200, signedRole: 0 });
  });
});
