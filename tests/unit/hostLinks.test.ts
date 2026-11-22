import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

/**
 * Host = the executive_producer crew role for one event.
 *   an executive_producer crew cookie → host banner + the full deck; plain crew → not host;
 *   minting a host link records the grant and the link carries the event code, the role, and the
 *   event's host code (never the crew code); revoking rotates the crew code and bumps the version, so a cookie minted with
 *   the old code is refused by the guard and the viewer, while a global-password cookie is not.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord } from "@/services/events/eventRepository";
import { crewCookieCurrent, getHostLinkState, hostCodeFor, hostLinkPathFor, mintHostLink, revokeHostLinks } from "@/services/events/hostLinkService";
import { resolveCrewAccess } from "@/services/access/eventAccessResolver";
import { getCrewAccessPassword } from "@/lib/env";
import { authorizeLiveControl, HOST_LINK_STATE_UNAVAILABLE_ERROR, REVOKED_HOST_LINK_ERROR, requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { crewViewerFromPayloads, getCrewViewer, viewerCan } from "@/lib/auth/crewViewer";
import { createV5AccessCookie, type V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { mintHostLinkAction, revokeHostLinksAction } from "@/lib/actions/hostActions";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import type { V4CrewRole } from "@/types/v4";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { HostPanel } from "@/components/events/HostPanel";

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
    const host = crewViewerFromPayloads({ crew: crew("executive_producer", "room-1", 0) }, "room-1");
    expect(host.isHost).toBe(true);
    for (const action of ["go_live", "moderate_chat", "manage_stage_access", "manage_cue_cards", "advance_run_of_show", "manage_host"] as const) expect(viewerCan(host, action), action).toBe(true);
    const plain = crewViewerFromPayloads({ crew: crew("crew", "room-1") }, "room-1");
    expect(plain.isHost).toBe(false);
    expect(viewerCan(plain, "manage_host")).toBe(false);
    // Only the executive producer (and owner/operator) may hand out or revoke a host link.
    expect(viewerCan(crewViewerFromPayloads({ crew: crew("producer", "room-1") }, "room-1"), "manage_host")).toBe(false);
  });

  it("a cookie minted with the event's crew code is only good for its code version; a global-password cookie never expires this way, and is never the host", () => {
    expect(crewCookieCurrent(undefined, 3)).toBe(true);
    expect(crewCookieCurrent(0, 0)).toBe(true);
    expect(crewCookieCurrent(0, 1)).toBe(false);
    expect(authorizeLiveControl({ crew: crew("executive_producer", "room-1", 0) }, "room-1", "go_live", 1)).toEqual({ ok: false, error: REVOKED_HOST_LINK_ERROR });
    expect(authorizeLiveControl({ crew: crew("executive_producer", "room-1", 1) }, "room-1", "go_live", 1)).toMatchObject({ ok: true });
    // An executive producer cookie with no code version (or no event) never came from a host code: it is plain crew, never the host.
    expect(authorizeLiveControl({ crew: crew("executive_producer", "room-1") }, "room-1", "go_live", 5)).toMatchObject({ ok: false });
    expect(authorizeLiveControl({ crew: { kind: "crew", role: "executive_producer", codeVersion: 0, issuedAt, expiresAt } }, "room-2", "go_live", 0)).toMatchObject({ ok: false });
    expect(crewViewerFromPayloads({ crew: { kind: "crew", role: "executive_producer", codeVersion: 0, issuedAt, expiresAt } }, "room-2")).toMatchObject({ isHost: false, role: "crew" });
    expect(authorizeLiveControl({ crew: crew("crew", "room-1") }, "room-1", "moderate_chat", 5).ok).toBe(authorizeLiveControl({ crew: crew("crew", "room-1", 5) }, "room-1", "moderate_chat", 5).ok);
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

  it("mint records the grant; the link is the crew gate prefilled with event code, role, and the host code; revoke rotates the code and ends old cookies", async () => {
    const before = (await findEventRecord(eventId))!;
    const hostCode0 = await hostCodeFor(eventId, 0);
    expect(hostCode0).toMatch(/^WPL-HOST-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(await hostLinkPathFor(before)).toBe(`/production-access/crew?event=${before.joinCode.toUpperCase()}&role=executive_producer&code=${hostCode0}`);
    expect(await hostLinkPathFor(before)).not.toContain(before.accessCodes.crew);

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
    expect(await hostLinkPathFor(after)).toContain(`code=${await hostCodeFor(eventId, 1)}`);
    expect(await hostCodeFor(eventId, 1)).not.toBe(hostCode0);
    // Direct service calls agree.
    await mintHostLink(eventId, "owner");
    expect((await getHostLinkState(eventId)).links.filter((link) => !link.revokedAt)).toHaveLength(1);
    await revokeHostLinks(eventId, "owner");
    expect((await getHostLinkState(eventId)).codeVersion).toBe(2);
  });

  it("the host link and its code show only to someone who may hand out the show: never plain crew, never a revoked crew member", async () => {
    await mintHostLink(eventId, "owner");
    const render = async (viewer: Parameters<typeof HostPanel>[0]["viewer"]) => renderToStaticMarkup((await HostPanel({ eventId, viewer }))!);
    const hostCode = await hostCodeFor(eventId, (await getHostLinkState(eventId)).codeVersion);
    expect(await render(crewViewerFromPayloads({ owner: { kind: "owner", role: "owner", issuedAt, expiresAt } }, eventId))).toContain(hostCode);
    expect(await render(crewViewerFromPayloads({ operator: { kind: "operator", role: "executive_producer", issuedAt, expiresAt } }, eventId))).toContain(hostCode);
    expect(await render(crewViewerFromPayloads({ crew: crew("executive_producer", eventId, 0) }, eventId, 0))).toContain(hostCode);
    for (const role of ["crew", "producer", "technical_director", "moderator"] as V4CrewRole[]) {
      const html = await render(crewViewerFromPayloads({ crew: crew(role, eventId, 0) }, eventId, 0));
      expect(html, role).not.toContain("WPL-HOST");
      expect(html, role).toContain("host-link-hidden");
    }
    // Revoked, then a new link minted: the revoked crew member still reaches the deck, and must not see the new link.
    await revokeHostLinks(eventId, "owner");
    await mintHostLink(eventId, "owner");
    const state = await getHostLinkState(eventId);
    const revoked = crewViewerFromPayloads({ crew: crew("technical_director", eventId, 0) }, eventId, state.codeVersion);
    expect(revoked.kind).toBe("none");
    expect(await render(revoked)).not.toContain("WPL-HOST");
  });

  it("with no event code, executive producer is refused, even with the global crew password, at the resolver and at the crew door", async () => {
    const globalPassword = getCrewAccessPassword()?.trim();
    expect(globalPassword).toBeTruthy();
    expect(await resolveCrewAccess(undefined, "executive_producer", globalPassword)).toMatchObject({ ok: false, reason: "host_link_required" });
    expect(await resolveCrewAccess("  ", "executive_producer", globalPassword)).toMatchObject({ ok: false, reason: "host_link_required" });
    // Other crew roles still come in with the global password and no event.
    expect(await resolveCrewAccess(undefined, "producer", globalPassword)).toMatchObject({ ok: true, role: "producer" });

    const saved = { crew: process.env.CREW_ACCESS_PASSWORD, operator: process.env.OPERATOR_LAUNCHPAD_PASSWORD, secret: process.env.V5_ACCESS_COOKIE_SECRET };
    process.env.CREW_ACCESS_PASSWORD = globalPassword;
    process.env.OPERATOR_LAUNCHPAD_PASSWORD ||= "operator-test-password";
    process.env.V5_ACCESS_COOKIE_SECRET ||= getV5AccessCookieSecret(getEnv());
    onTestFinished(() => { for (const [key, value] of [["CREW_ACCESS_PASSWORD", saved.crew], ["OPERATOR_LAUNCHPAD_PASSWORD", saved.operator], ["V5_ACCESS_COOKIE_SECRET", saved.secret]] as const) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
    const { POST } = await import("@/app/api/production-access/crew/route");
    const form = new FormData();
    form.set("password", globalPassword!);
    form.set("eventCode", "");
    form.set("crewRole", "executive_producer");
    const response = await POST(new NextRequest("https://westpeek.live/api/production-access/crew", { method: "POST", body: form }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=host_only");
    expect(response.headers.get("set-cookie") || "").not.toContain(getV5AccessCookieNames(getEnv()).crewCookieName);
  });

  it("the crew code never opens executive producer: only the event's current host code does", async () => {
    const event = (await findEventRecord(eventId))!;
    const join = event.joinCode.toUpperCase();
    // The crew code opens a crew role…
    expect(await resolveCrewAccess(join, "producer", event.accessCodes.crew)).toMatchObject({ ok: true, role: "producer" });
    // …but picking Executive producer from the list with it, or with the global crew password, is refused.
    expect(await resolveCrewAccess(join, "executive_producer", event.accessCodes.crew)).toMatchObject({ ok: false, reason: "host_link_required" });
    const globalPassword = getCrewAccessPassword()?.trim();
    if (globalPassword) expect(await resolveCrewAccess(join, "executive_producer", globalPassword)).toMatchObject({ ok: false, reason: "host_link_required" });
    expect(await resolveCrewAccess(join, "executive_producer", "")).toMatchObject({ ok: false, reason: "host_link_required" });
    // The host code from a host link opens it; once the links are revoked the old host code is dead.
    const hostCode = await hostCodeFor(eventId, 0);
    expect(await resolveCrewAccess(join, "executive_producer", hostCode.toLowerCase().replaceAll("-", " "))).toMatchObject({ ok: true, role: "executive_producer", eventId });
    await revokeHostLinks(eventId, "owner");
    expect(await resolveCrewAccess(join, "executive_producer", hostCode)).toMatchObject({ ok: false, reason: "host_link_required" });
    expect(await resolveCrewAccess(join, "executive_producer", await hostCodeFor(eventId, 1))).toMatchObject({ ok: true });
    // The host code is per event: one event's host code never opens another.
    const other = await createEventRecord({ name: `Other ${Date.now()}`, when: "now" }, owner);
    expect(await resolveCrewAccess(other.joinCode, "executive_producer", await hostCodeFor(eventId, 1))).toMatchObject({ ok: false });
  });

  it("store outage: a revoked crew cookie is refused with 503 on live control, never treated as version 0; a revoke during the outage writes nothing", async () => {
    await revokeHostLinks(eventId, "owner");
    await revokeHostLinks(eventId, "owner");
    expect((await getHostLinkState(eventId)).codeVersion).toBe(2);
    // The cookie a revoked host still holds, from before both revokes.
    await signInAsCrew("executive_producer", eventId, 0);
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toEqual({ ok: false, error: REVOKED_HOST_LINK_ERROR });

    const read = vi.spyOn(store, "getEventGuestState").mockRejectedValue(new Error("D1_ERROR: network connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    onTestFinished(() => { vi.restoreAllMocks(); });
    for (const action of ["go_live", "moderate_chat", "manage_host", undefined] as const) {
      expect(await requireLiveEventControlAccessForRequest(eventId, action), String(action)).toEqual({ ok: false, error: HOST_LINK_STATE_UNAVAILABLE_ERROR, status: 503 });
    }
    expect(await getCrewViewer(eventId)).toMatchObject({ kind: "none", isHost: false, allowed: [] });
    // A current cookie is refused too: nobody can tell it is current.
    await signInAsCrew("executive_producer", eventId, 2);
    expect(await requireLiveEventControlAccessForRequest(eventId, "go_live")).toMatchObject({ ok: false, status: 503 });
    // Owner and the global crew password (no code version) need no read and still work.
    expect(authorizeLiveControl({ owner: { kind: "owner", issuedAt, expiresAt } }, eventId, "go_live")).toMatchObject({ ok: true });
    await signInAsCrew("crew", eventId);
    expect(await requireLiveEventControlAccessForRequest(eventId)).toMatchObject({ ok: true, crewRole: "crew" });
    // A revoke cannot read the version, so it must fail before it writes anything: not version 1 over version 2, not a rotated crew code with the old version.
    const crewCodeBefore = (await findEventRecord(eventId))!.accessCodes.crew;
    await expect(revokeHostLinks(eventId, "owner")).rejects.toThrow(/could not be read/);
    read.mockRestore();
    expect((await getHostLinkState(eventId)).codeVersion).toBe(2);
    expect((await findEventRecord(eventId))!.accessCodes.crew).toBe(crewCodeBefore);
  });
});
