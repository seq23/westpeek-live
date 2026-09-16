import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Custom and rotated codes against the store: a hand-set code is stored normalized and resolves
 * typed in any case; two codes differing only by case cannot coexist (join across events, roles
 * within the event); changing a role code bumps its version and a guest cookie minted before is
 * stale; changing the crew code rotates the host-link version; regenerate mints a fresh one.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord } from "@/services/events/eventRepository";
import { codeIsFree, getAccessCodeVersions, guestAccessStale, guestCookieCurrent, setEventAccessCode } from "@/services/events/accessCodeService";
import { getHostLinkState } from "@/services/events/hostLinkService";
import { resolveCrewAccess, resolveSpecialGuestAccess } from "@/services/access/eventAccessResolver";
import { createV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Sequoia Taylor / owner", role: "owner" };

describe("custom and rotated access codes", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-codes-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    jar.clear();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a hand-set speaker code is stored uppercase and resolves typed lowercase, mixed, or with spaces; the old code stops working", async () => {
    const event = await createEventRecord({ name: `Codes ${Date.now()}`, when: "now" }, owner);
    const oldCode = event.accessCodes.speaker;
    const result = await setEventAccessCode(event.id, "speaker", { value: " founders-2026 " }, "owner");
    expect(result).toMatchObject({ ok: true, code: "FOUNDERS-2026" });
    expect((await findEventRecord(event.id))!.accessCodes.speaker).toBe("FOUNDERS-2026");
    resetOverlayForTests();
    for (const typed of ["founders-2026", "Founders 2026", "FOUNDERS2026"]) expect((await resolveSpecialGuestAccess(event.joinCode, typed)).ok, typed).toBe(true);
    expect((await resolveSpecialGuestAccess(event.joinCode, oldCode)).ok).toBe(false);
    expect((await getAccessCodeVersions(event.id)).speaker).toBe(1);
  });

  it("a code differing only by case cannot coexist: within the event across roles, and join codes across events", async () => {
    const a = await createEventRecord({ name: `Codes A ${Date.now()}`, when: "now" }, owner);
    const b = await createEventRecord({ name: `Codes B ${Date.now()}`, when: "later", startAt: "2030-01-01T10:00" }, owner);
    expect(await setEventAccessCode(a.id, "vip", { value: "gold-room" }, "owner")).toMatchObject({ ok: true });
    expect(await setEventAccessCode(a.id, "sponsor", { value: "GOLD ROOM" }, "owner")).toMatchObject({ ok: false, reason: /another role/ });
    expect(await setEventAccessCode(a.id, "join", { value: "Summit-One" }, "owner")).toMatchObject({ ok: true, code: "SUMMIT-ONE" });
    expect(await setEventAccessCode(b.id, "join", { value: "summit one" }, "owner")).toMatchObject({ ok: false, reason: /Another event/ });
    expect(codeIsFree({ field: "join", stored: "summit-one", event: b, allEvents: [(await findEventRecord(a.id))!, b] })).toBe(false);
    expect((await findEventRecord("SUMMIT ONE"))?.id).toBe(a.id);
    expect(await setEventAccessCode(a.id, "client", { value: "abc" }, "owner")).toMatchObject({ ok: false, reason: /4–24/ });
  });

  it("changing the crew code rotates the host-link version; regenerate mints a fresh code", async () => {
    const event = await createEventRecord({ name: `Codes crew ${Date.now()}`, when: "now" }, owner);
    expect((await getHostLinkState(event.id)).codeVersion).toBe(0);
    const custom = await setEventAccessCode(event.id, "crew", { value: "crew-day-one" }, "owner");
    expect(custom).toMatchObject({ ok: true, code: "CREW-DAY-ONE" });
    expect((await getHostLinkState(event.id)).codeVersion).toBe(1);
    resetOverlayForTests();
    expect((await resolveCrewAccess(event.joinCode, "moderator", "crew day one")).ok).toBe(true);
    const regenerated = await setEventAccessCode(event.id, "crew", { regenerate: true }, "owner");
    expect(regenerated.ok && regenerated.code).toMatch(/^CREW-[A-Z0-9]{6}$/);
    expect((await getHostLinkState(event.id)).codeVersion).toBe(2);
  });

  it("a guest cookie minted before a role-code change is stale; one minted after is current; seed and unversioned cookies never are", async () => {
    const event = await createEventRecord({ name: `Codes guest ${Date.now()}`, when: "now" }, owner);
    const env = getEnv();
    const { specialGuestCookieName } = getV5AccessCookieNames(env);
    jar.set(specialGuestCookieName, await createV5AccessCookie({ kind: "special_guest", eventId: event.id, role: "speaker", codeVersion: 0, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 }, getV5AccessCookieSecret(env)));
    expect(await guestAccessStale(event.id)).toBe(false);
    await setEventAccessCode(event.id, "speaker", { regenerate: true }, "owner");
    expect(await guestAccessStale(event.id)).toBe(true);
    jar.set(specialGuestCookieName, await createV5AccessCookie({ kind: "special_guest", eventId: event.id, role: "speaker", codeVersion: 1, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 }, getV5AccessCookieSecret(env)));
    expect(await guestAccessStale(event.id)).toBe(false);
    jar.set(specialGuestCookieName, await createV5AccessCookie({ kind: "special_guest", eventId: event.id, role: "sponsor", codeVersion: 0, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 }, getV5AccessCookieSecret(env)));
    expect(await guestAccessStale(event.id)).toBe(false); // the sponsor code did not change
    expect(guestCookieCurrent(undefined, 5)).toBe(true);
  });
});
