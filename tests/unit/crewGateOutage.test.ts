import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The crew gate in a store outage. An event's own crew code needs the host-link version read before
 * a cookie is minted (#127). When that read fails the gate says "Can't check access right now", as the
 * special-guest gate does, instead of Next's error page; no cookie is minted, the store's text stays in
 * the log, and the owner password still opens the door.
 */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "cf-connecting-ip": "203.0.113.9" }),
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); }, delete: (name: string) => { jar.delete(name); } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord, findEventRecord } from "@/services/events/eventRepository";
import { resetGateAttemptsForTests } from "@/services/access/gateAttemptLimiter";
import { POST } from "@/app/api/production-access/crew/route";
import CrewAccessPage from "@/app/production-access/crew/page";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };
const OWNER_PASSWORD = "owner-test-master-2027";

function post(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/production-access/crew", { method: "POST", body: new URLSearchParams(fields), headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": "203.0.113.9" } });
}
async function enter(fields: Record<string, string>) {
  const answer = (await POST(post(fields))) as unknown as { status: number; headers: Headers; cookies: { getAll(): { name: string }[] } };
  return { status: answer.status, location: answer.headers.get("location") || "", cookies: answer.cookies.getAll().map((cookie) => cookie.name) };
}

describe("crew gate: a store outage is 'can't check access right now', never an error page", () => {
  let tempDir: string;
  let store: FileRuntimeStore;
  let fields: Record<string, string>;
  beforeEach(async () => {
    jar.clear();
    resetGateAttemptsForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-crew-outage-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    store = new FileRuntimeStore(path.join(tempDir, "runtime.json"));
    setRuntimeStoreForTests(store);
    resetOverlayForTests();
    vi.stubEnv("OWNER_MASTER_ACCESS_PASSWORD", OWNER_PASSWORD);
    vi.stubEnv("CREW_ACCESS_PASSWORD", "crew-test-password");
    vi.stubEnv("OPERATOR_LAUNCHPAD_PASSWORD", "operator-test-password");
    vi.stubEnv("V5_ACCESS_COOKIE_SECRET", "test-cookie-secret-test-cookie-secret");
    const event = (await findEventRecord((await createEventRecord({ name: `Crew outage ${Date.now()}`, when: "now" }, owner)).id))!;
    fields = { eventCode: event.joinCode, password: event.accessCodes.crew, crewRole: "executive_producer" };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("the event's crew code gets in while the store answers", async () => {
    const ok = await enter(fields);
    expect(ok.location).toMatch(/\/crew\/events\//);
    expect(ok.cookies.length).toBe(1);
  });

  it("with the store down: redirected to the gate's notice, no cookie, store text only in the log; the owner password still opens", async () => {
    vi.spyOn(store, "getEventGuestState").mockRejectedValue(new Error("D1_ERROR: no such table: event_guest_states SQLITE_ERROR"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const down = await enter(fields);
    expect(new URL(down.location).pathname + new URL(down.location).search).toBe("/production-access/crew?error=unavailable");
    expect(down.cookies).toEqual([]);
    expect(down.location).not.toContain("D1_ERROR");
    expect(logged.mock.calls.some((call) => call.join(" ").includes("D1_ERROR"))).toBe(true);

    const html = renderToStaticMarkup(await CrewAccessPage({ searchParams: Promise.resolve({ error: "unavailable" }) }));
    expect(html).toContain('data-testid="crew-access-unavailable"');
    expect(html).not.toContain("D1_ERROR");

    const asOwner = await enter({ ...fields, password: OWNER_PASSWORD });
    expect(asOwner.location).not.toContain("error=");
    expect(asOwner.cookies.length).toBe(1);
  });
});
