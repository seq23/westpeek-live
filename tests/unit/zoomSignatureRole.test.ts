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
import { saveEventBackupRoom } from "@/services/video/backupRoomService";
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
const HOUSE = "123456789";

async function askFull(eventId: string, body: Record<string, unknown>) {
  const response = await POST(new Request("http://local/api/video/zoom-signature", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, meetingNumber: HOUSE, ...body }) }));
  const json = (await response.json()) as { result?: { signature: string }; error?: string };
  const claims = json.result ? JSON.parse(Buffer.from(json.result.signature.split(".")[1], "base64url").toString()) : undefined;
  return { status: response.status, signedRole: claims?.role as number | undefined, mn: claims?.mn as string | undefined, error: json.error };
}

async function ask(eventId: string, body: Record<string, unknown>) {
  const { status, signedRole } = await askFull(eventId, body);
  return { status, signedRole };
}

describe("Zoom signature: the host role is signed only through the live-control rule", () => {
  let tempDir: string;
  let eventId: string;
  let store: FileRuntimeStore;
  beforeEach(async () => {
    process.env.ZOOM_MEETING_SDK_KEY = "test-key";
    process.env.ZOOM_MEETING_SDK_SECRET = "test-secret";
    process.env.ZOOM_MEETING_NUMBER = HOUSE;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-zoom-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    store = new FileRuntimeStore(path.join(tempDir, "runtime.json"));
    setRuntimeStoreForTests(store);
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: `Zoom ${Date.now()}`, when: "now" }, owner)).id;
    jar.clear();
  });
  afterEach(() => {
    delete process.env.ZOOM_MEETING_SDK_KEY;
    delete process.env.ZOOM_MEETING_SDK_SECRET;
    delete process.env.ZOOM_MEETING_NUMBER;
    vi.restoreAllMocks();
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
    jar.clear();
  });

  it("no cookie: an observer is signed role 0, and asking for role 1 is refused", async () => {
    expect(await ask(eventId, { zoomRole: 0, videoRole: "observer" })).toEqual({ status: 200, signedRole: 0 });
    expect(await ask(eventId, { zoomRole: 1, videoRole: "observer" })).toEqual({ status: 403, signedRole: undefined });
    expect(await ask(eventId, { zoomRole: 1 })).toEqual({ status: 403, signedRole: undefined });
    // Old alias fields are not read at all: smuggling role 1 through them signs 0.
    expect(await ask(eventId, { role: 1, meetingRole: 1, videoRole: "observer" })).toEqual({ status: 200, signedRole: 0 });
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

  it("view-only crew, support and va are refused the host role (they hold no go_live); technical director gets it", async () => {
    for (const role of ["crew", "support", "va", "moderator"]) {
      await signIn("crew", { kind: "crew", role, eventId, codeVersion: 0 });
      expect(await ask(eventId, { zoomRole: 1, videoRole: "producer" }), role).toEqual({ status: 403, signedRole: undefined });
      expect(await ask(eventId, { zoomRole: 0, videoRole: "host" }), `${role} via videoRole host`).toEqual({ status: 403, signedRole: undefined });
    }
    await signIn("crew", { kind: "crew", role: "technical_director", eventId, codeVersion: 0 });
    expect(await ask(eventId, { zoomRole: 1 })).toEqual({ status: 200, signedRole: 1 });
  });

  it("only this event's own meeting is signed: another number is refused, an omitted one is picked by the server", async () => {
    const other = (await createEventRecord({ name: `Zoom other ${Date.now()}`, when: "now" }, owner)).id;
    expect((await saveEventBackupRoom({ eventId: other, zoomMeetingNumber: "99988877766", savedBy: "owner" })).ok).toBe(true);
    await signIn("crew", { kind: "crew", role: "executive_producer", eventId, codeVersion: 0 });
    // Event A's host asks for event B's meeting, under A's id: refused, nothing signed.
    expect(await askFull(eventId, { zoomRole: 1, meetingNumber: "99988877766" })).toMatchObject({ status: 403, signedRole: undefined });
    // With no number sent, A gets the house meeting, never B's.
    expect(await askFull(eventId, { zoomRole: 1, meetingNumber: undefined })).toMatchObject({ status: 200, signedRole: 1, mn: HOUSE });
    // No cookie: role 0 for B's own meeting only; the house number is not B's meeting any more.
    jar.clear();
    expect(await askFull(other, { videoRole: "observer", meetingNumber: undefined })).toMatchObject({ status: 200, signedRole: 0, mn: "99988877766" });
    expect(await askFull(other, { videoRole: "observer", meetingNumber: HOUSE })).toMatchObject({ status: 403, signedRole: undefined });
    // An event id that does not exist signs nothing, so there is no open signer for arbitrary meetings.
    expect(await askFull("no-such-event", { videoRole: "observer" })).toMatchObject({ status: 404, signedRole: undefined });
    // No house number and no saved one: nothing to sign.
    delete process.env.ZOOM_MEETING_NUMBER;
    expect(await askFull(eventId, { videoRole: "observer", meetingNumber: undefined })).toMatchObject({ status: 409, signedRole: undefined });
  });

  it("store outage: a revoked host gets 503, never role 1; a failed meeting read is a 500 with no internals", async () => {
    await signIn("crew", { kind: "crew", role: "executive_producer", eventId, codeVersion: 0 });
    await revokeHostLinks(eventId, "owner");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const guestState = vi.spyOn(store, "getEventGuestState").mockRejectedValue(new Error("D1_ERROR: secret-ish internal detail"));
    expect(await askFull(eventId, { zoomRole: 1 })).toMatchObject({ status: 503, signedRole: undefined });
    guestState.mockRestore();
    await signIn("operator", { kind: "operator", eventId });
    vi.spyOn(store, "getEventBackupRoom").mockRejectedValue(new Error("D1_ERROR: secret-ish internal detail"));
    const failed = await askFull(eventId, { zoomRole: 1 });
    expect(failed).toMatchObject({ status: 500, signedRole: undefined });
    expect(failed.error).not.toMatch(/D1|secret|internal/);
  });
});
