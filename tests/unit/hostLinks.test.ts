import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

/**
 * Host = the executive_producer crew role for one event.
 *   an executive_producer crew cookie → host banner + the full deck; plain crew → not host;
 *   minting a host link records the grant and the link carries the event code, the role, and the
 *   event's crew code; revoking rotates the crew code and bumps the version, so a cookie minted with
 *   the old code is refused by the guard and the viewer, while a global-password cookie is not.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord } from "@/services/events/eventRepository";
import { ACCESS_UNAVAILABLE_MESSAGE, crewCookieCurrent, getHostLinkState, hostLinkPath, mintHostLink, revokeHostLinks } from "@/services/events/hostLinkService";
import { getAccessCodeVersions, guestAccessStale } from "@/services/events/accessCodeService";
import { HostPanel } from "@/components/events/HostPanel";
import { renderToStaticMarkup } from "react-dom/server";
import { authorizeLiveControl, REVOKED_HOST_LINK_ERROR, requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { crewViewerFromPayloads, getCrewViewer, viewerCan } from "@/lib/auth/crewViewer";
import { createV5AccessCookie, type V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { mintHostLinkAction, revokeHostLinksAction } from "@/lib/actions/hostActions";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import type { V4CrewRole } from "@/types/v4";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };
const issuedAt = Date.now();
const expiresAt = issuedAt + 60_000;
const crew = (role: V4CrewRole, eventId: string, codeVersion?: number): V5AccessCookiePayload => ({ kind: "crew", role, eventId, codeVersion, issuedAt, expiresAt });

async function signInAsCrew(role: V4CrewRole, eventId: string, codeVersion?: number) {
  const env = getEnv();
  jar.clear();
  jar.set(getV5AccessCookieNames(env).crewCookieName, await createV5AccessCookie(crew(role, eventId, codeVersion), getV5AccessCookieSecret(env)));
}

describe("host = executive_producer crew role", () => {
  it("an executive_producer crew cookie is the host with every deck permission; plain crew is not", () => {
    const host = crewViewerFromPayloads({ crew: crew("executive_producer", "room-1") }, "room-1");
    expect(host.isHost).toBe(true);
    for (const action of ["go_live", "moderate_chat", "manage_stage_access", "manage_cue_cards", "advance_run_of_show", "manage_host"] as const) expect(viewerCan(host, action), action).toBe(true);
    const plain = crewViewerFromPayloads({ crew: crew("crew", "room-1") }, "room-1");
    expect(plain.isHost).toBe(false);
    expect(viewerCan(plain, "manage_host")).toBe(false);
    // Only the executive producer (and owner/operator) may hand out or revoke a host link.
    expect(viewerCan(crewViewerFromPayloads({ crew: crew("producer", "room-1") }, "room-1"), "manage_host")).toBe(false);
  });

  it("a cookie minted with the event's crew code is only good for its code version; a global-password cookie never expires this way", () => {
    expect(crewCookieCurrent(undefined, 3)).toBe(true);
    expect(crewCookieCurrent(0, 0)).toBe(true);
    expect(crewCookieCurrent(0, 1)).toBe(false);
    expect(authorizeLiveControl({ crew: crew("executive_producer", "room-1", 0) }, "room-1", "go_live", 1)).toEqual({ ok: false, error: REVOKED_HOST_LINK_ERROR });
    expect(authorizeLiveControl({ crew: crew("executive_producer", "room-1", 1) }, "room-1", "go_live", 1)).toMatchObject({ ok: true });
    expect(authorizeLiveControl({ crew: crew("executive_producer", "room-1") }, "room-1", "go_live", 5)).toMatchObject({ ok: true });
    expect(crewViewerFromPayloads({ crew: crew("executive_producer", "room-1", 0) }, "room-1", 1)).toMatchObject({ kind: "none", isHost: false, label: "Crew link revoked" });
  });
});

describe("host links against the store", () => {
  let tempDir: string;
  let eventId: string;
  let store: FileRuntimeStore;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-host-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    store = new FileRuntimeStore(path.join(tempDir, "runtime.json"));
    setRuntimeStoreForTests(store);
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: `Host ${Date.now()}`, when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); jar.clear(); });

  it("mint records the grant; the link is the crew gate prefilled with event code, role, and the crew code; revoke rotates the code and ends old cookies", async () => {
    const before = (await findEventRecord(eventId))!;
    expect(hostLinkPath(before)).toBe(`/production-access/crew?event=${before.joinCode.toUpperCase()}&role=executive_producer&code=${before.accessCodes.crew}`);

    // Only the executive producer, owner, or operator may mint; a producer is refused with the reason.
    const form = new FormData(); form.set("eventId", eventId);
    await signInAsCrew("producer", eventId);
    await expect(mintHostLinkAction(form)).rejects.toThrow(/Producer can't mint or revoke a host link/);
    await signInAsCrew("executive_producer", eventId, 0);
    await mintHostLinkAction(form);
    const minted = await getHostLinkState(eventId);
    expect(minted.links).toHaveLength(1);
    expect(minted.links[0]).toMatchObject({ grantedBy: "crew:executive_producer", codeVersion: 0 });

    // The host who entered through the link is the host on the deck and the guard.
    expect((await getCrewViewer(eventId)).isHost).toBe(true);
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toMatchObject({ ok: true, crewRole: "executive_producer" });

    // Revoke: crew code rotated, version bumped, link marked revoked, the old cookie refused everywhere.
    await revokeHostLinksAction(form);
    const after = (await findEventRecord(eventId))!;
    expect(after.accessCodes.crew).not.toBe(before.accessCodes.crew);
    expect(after.accessCodes.speaker).toBe(before.accessCodes.speaker);
    const revoked = await getHostLinkState(eventId);
    expect(revoked.codeVersion).toBe(1);
    expect(revoked.links[0].revokedAt).toBeTruthy();
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toEqual({ ok: false, error: REVOKED_HOST_LINK_ERROR });
    expect((await getCrewViewer(eventId)).isHost).toBe(false);
    // A fresh link is against the new code and the new version.
    await signInAsCrew("executive_producer", eventId, 1);
    expect((await getCrewViewer(eventId)).isHost).toBe(true);
    expect(hostLinkPath(after)).toContain(`code=${after.accessCodes.crew}`);
    // Direct service calls agree.
    await mintHostLink(eventId, "owner");
    expect((await getHostLinkState(eventId)).links.filter((link) => !link.revokedAt)).toHaveLength(1);
    await revokeHostLinks(eventId, "owner");
    expect((await getHostLinkState(eventId)).codeVersion).toBe(2);
  });

  function storeDown() {
    const read = vi.spyOn(store, "getEventGuestState").mockRejectedValue(new Error("D1_ERROR: no such table: event_guest_states SQLITE_ERROR"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    onTestFinished(() => { vi.restoreAllMocks(); });
    return { read, logged };
  }

  async function addOperatorCookie(operatorEventId: string) {
    const env = getEnv();
    jar.set(getV5AccessCookieNames(env).operatorCookieName, await createV5AccessCookie({ kind: "operator", eventId: operatorEventId, issuedAt, expiresAt }, getV5AccessCookieSecret(env)));
  }

  it("store outage: a revoked crew cookie gets 503 on live control, never version 0; owner, operator and the global crew password keep working; a revoke writes nothing", async () => {
    await revokeHostLinks(eventId, "owner");
    await revokeHostLinks(eventId, "owner");
    await signInAsCrew("executive_producer", eventId, 0);
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toEqual({ ok: false, error: REVOKED_HOST_LINK_ERROR });

    const { read } = storeDown();
    for (const action of ["go_live", "moderate_chat", "manage_host", undefined] as const) {
      expect(await requireLiveEventControlAccessForRequest(eventId, action), String(action)).toEqual({ ok: false, error: ACCESS_UNAVAILABLE_MESSAGE, status: 503 });
    }
    expect(await getCrewViewer(eventId)).toMatchObject({ kind: "none", isHost: false, allowed: [] });
    // A current cookie is refused too: nobody can tell it is current.
    await signInAsCrew("executive_producer", eventId, 2);
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toMatchObject({ ok: false, status: 503 });
    // An operator for this event needs no read.
    await addOperatorCookie(eventId);
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toMatchObject({ ok: true, actorRole: "operator" });
    // The global crew password (no code version) needs no read: today's codes let in exactly whom they let in before.
    await signInAsCrew("executive_producer", eventId);
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toMatchObject({ ok: true, crewRole: "executive_producer" });
    // A revoke cannot read the version, so it stops before it writes: not version 1 over 2, not a rotated crew code.
    const crewCodeBefore = (await findEventRecord(eventId))!.accessCodes.crew;
    await expect(revokeHostLinks(eventId, "owner")).rejects.toThrow(ACCESS_UNAVAILABLE_MESSAGE);
    read.mockRestore();
    expect((await getHostLinkState(eventId)).codeVersion).toBe(2);
    expect((await findEventRecord(eventId))!.accessCodes.crew).toBe(crewCodeBefore);
  });

  it("an operator cookie for ANOTHER event does not reopen a revoked host cookie, and in an outage it still gets 503", async () => {
    await revokeHostLinks(eventId, "owner");
    await signInAsCrew("executive_producer", eventId, 0);
    await addOperatorCookie("some-other-event");
    expect(await requireLiveEventControlAccessForRequest(eventId, "manage_host")).toEqual({ ok: false, error: REVOKED_HOST_LINK_ERROR });
    storeDown();
    expect(await requireLiveEventControlAccessForRequest(eventId, "manage_host")).toEqual({ ok: false, error: ACCESS_UNAVAILABLE_MESSAGE, status: 503 });
  });

  it("the store's own error text never reaches the page; it goes to the server log", async () => {
    const { logged } = storeDown();
    const html = await HostPanel({ eventId }).then((node) => renderToStaticMarkup(node), (error: Error) => error.message);
    expect(html).not.toContain("D1_ERROR");
    expect(html).not.toContain("event_guest_states");
    expect(logged.mock.calls.some((call) => call.join(" ").includes("D1_ERROR"))).toBe(true);
  });

  it("a revoke whose code rotation fails has already ended every old crew cookie", async () => {
    await signInAsCrew("executive_producer", eventId, 0);
    vi.spyOn(store, "upsertRuntimeEvent").mockRejectedValueOnce(new Error("write failed"));
    onTestFinished(() => { vi.restoreAllMocks(); });
    await expect(revokeHostLinks(eventId, "owner")).rejects.toThrow("write failed");
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toEqual({ ok: false, error: REVOKED_HOST_LINK_ERROR });
  });

  it("store outage on guest codes: a versioned guest cookie is sent to the gate as 'unavailable', never let in as version 0", async () => {
    const env = getEnv();
    jar.clear();
    jar.set(getV5AccessCookieNames(env).specialGuestCookieName, await createV5AccessCookie({ kind: "special_guest", role: "speaker", eventId, codeVersion: 0, issuedAt, expiresAt }, getV5AccessCookieSecret(env)));
    expect(await guestAccessStale(eventId)).toBe(false);
    storeDown();
    expect(await guestAccessStale(eventId)).toBe("unavailable");
    await expect(getAccessCodeVersions(eventId)).rejects.toThrow(ACCESS_UNAVAILABLE_MESSAGE);
  });
});
