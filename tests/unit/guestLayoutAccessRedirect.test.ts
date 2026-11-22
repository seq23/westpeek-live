import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

/**
 * What a guest layout does with the guest cookie, against the real store (no mocked guestAccessStale):
 *   a guest whose code was rotated is sent to the gate with error=rotated;
 *   a guest arriving while the store cannot be read is sent with error=unavailable, never let in;
 *   the owner's master key walks through both.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));
vi.mock("next/navigation", () => ({ redirect: (target: string) => { throw new Error(`REDIRECT:${target}`); } }));
vi.mock("@/lib/events/canonicalEventRoute", () => ({ canonicalEventIdOrRedirect: async (id: string) => id }));
// The chrome is not under test, and the real bar would drag React's server cache() into a node test.
vi.mock("@/components/command/EventChromeStack", () => ({ EventChromeStack: () => null }));
vi.mock("@/components/command/EventCommandBar", () => ({ EventCommandBar: () => null }));
vi.mock("@/components/system/SafeSection", () => ({ SafeSection: () => null }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { setEventAccessCode } from "@/services/events/accessCodeService";
import { createV5AccessCookie, type V5AccessCookiePayload } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import SpeakerEventLayout from "@/app/speaker/events/[eventId]/layout";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };
const issuedAt = Date.now();
const expiresAt = issuedAt + 60_000;

describe("a guest layout and a stale or unreadable guest code", () => {
  let tempDir: string;
  let eventId: string;
  let store: FileRuntimeStore;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-guest-layout-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    store = new FileRuntimeStore(path.join(tempDir, "runtime.json"));
    setRuntimeStoreForTests(store);
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: `Guest layout ${Date.now()}`, when: "now" }, owner)).id;
    jar.clear();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); jar.clear(); });

  async function hold(payload: V5AccessCookiePayload, cookie: "specialGuestCookieName" | "ownerCookieName") {
    const env = getEnv();
    jar.set(getV5AccessCookieNames(env)[cookie], await createV5AccessCookie(payload, getV5AccessCookieSecret(env)));
  }
  const speakerGuest = (): V5AccessCookiePayload => ({ kind: "special_guest", role: "speaker", eventId, codeVersion: 0, issuedAt, expiresAt });
  const render = () => SpeakerEventLayout({ children: null, params: Promise.resolve({ eventId }) } as never);
  function storeDown() {
    vi.spyOn(store, "getEventGuestState").mockRejectedValue(new Error("D1_ERROR: no such table: event_guest_states SQLITE_ERROR"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    onTestFinished(() => { vi.restoreAllMocks(); });
  }

  it("lets a current guest in, and sends one whose code was rotated to the gate with error=rotated", async () => {
    await hold(speakerGuest(), "specialGuestCookieName");
    await expect(render()).resolves.toBeTruthy();
    await setEventAccessCode(eventId, "speaker", { regenerate: true }, "owner");
    await expect(render()).rejects.toThrow("REDIRECT:/production-access/special-guest?error=rotated");
  });

  it("sends a guest to the gate with error=unavailable when the store cannot be read, never in", async () => {
    await hold(speakerGuest(), "specialGuestCookieName");
    storeDown();
    await expect(render()).rejects.toThrow("REDIRECT:/production-access/special-guest?error=unavailable");
  });

  it("the owner's master key still gets in with a rotated guest cookie and with the store down", async () => {
    await hold(speakerGuest(), "specialGuestCookieName");
    await hold({ kind: "owner", role: "owner", issuedAt, expiresAt }, "ownerCookieName");
    await setEventAccessCode(eventId, "speaker", { regenerate: true }, "owner");
    await expect(render()).resolves.toBeTruthy();
    storeDown();
    await expect(render()).resolves.toBeTruthy();
  });
});
