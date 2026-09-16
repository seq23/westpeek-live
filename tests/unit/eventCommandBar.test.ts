import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Event Command Bar and the health signal.
 *
 * Two things must hold whatever else changes: the bar never renders for anyone but owner and
 * operator (it carries go live, the codes and the stream key), and the health dot never reads
 * green off a probe that did not run.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { createV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { getEventHealthReport } from "@/services/venue/eventHealthService";
import { healthSummary, settle, settleAll, worstLevel, type HealthSignal } from "@/lib/venue/eventHealth";
import { commandBarVisibleTo, switchEventPath, surfaceForPath } from "@/lib/navigation/eventCommandSurfaces";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

let dir: string;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "command-bar-"));
  setRuntimeStoreForTests(new FileRuntimeStore(path.join(dir, "runtime.json")));
  resetOverlayForTests();
  jar.clear();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function signIn(kind: "owner" | "operator" | "crew", eventId?: string) {
  const env = getEnv();
  const names = getV5AccessCookieNames(env);
  const secret = getV5AccessCookieSecret(env);
  const name = kind === "owner" ? names.ownerCookieName : kind === "operator" ? names.operatorCookieName : names.crewCookieName;
  jar.set(name, await createV5AccessCookie({ kind, role: kind === "crew" ? "moderator" : kind, eventId, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 } as never, secret));
}

function signal(over: Partial<HealthSignal>): HealthSignal {
  return { key: "feed", label: "Feed", level: "green", detail: "", source: "test", checkedAt: new Date().toISOString(), ...over };
}

describe("the bar is for the master key only", () => {
  it("is hidden from an anonymous attendee in the room", async () => {
    const event = await createEventRecord({ name: "Attendee test", when: "later" }, owner);
    expect(commandBarVisibleTo(await getCrewViewer(event.id))).toBe(false);
  });

  it("is hidden from plain crew — the deck is theirs, the master controls are not", async () => {
    const event = await createEventRecord({ name: "Crew test", when: "later" }, owner);
    await signIn("crew", event.id);
    const viewer = await getCrewViewer(event.id);
    expect(viewer.kind).toBe("crew");
    expect(commandBarVisibleTo(viewer)).toBe(false);
  });

  it("shows for the owner and for the operator", async () => {
    const event = await createEventRecord({ name: "Owner test", when: "later" }, owner);
    await signIn("owner");
    expect(commandBarVisibleTo(await getCrewViewer(event.id))).toBe(true);
    jar.clear();
    await signIn("operator", event.id);
    expect(commandBarVisibleTo(await getCrewViewer(event.id))).toBe(true);
  });
});

describe("the dot is the worst of its signals, and grey beats green", () => {
  it("is green only when every signal is green", () => {
    expect(worstLevel([signal({}), signal({ key: "chat" })])).toBe("green");
  });

  it("never reads green while a probe has not run", () => {
    expect(worstLevel([signal({}), signal({ key: "capacity", level: "unknown", checkedAt: undefined })])).toBe("unknown");
  });

  it("reads red over yellow, unknown and green together", () => {
    expect(worstLevel([signal({ level: "green" }), signal({ key: "chat", level: "yellow" }), signal({ key: "capacity", level: "unknown" }), signal({ key: "stage", level: "red" })])).toBe("red");
  });

  it("forces a signal with no checked time to unknown however it was written", () => {
    expect(settle(signal({ level: "green", checkedAt: undefined })).level).toBe("unknown");
    expect(settleAll([signal({ level: "yellow", checkedAt: undefined })])[0].level).toBe("unknown");
  });

  it("names the unmeasured signals rather than calling them fine", () => {
    expect(healthSummary([signal({}), signal({ key: "capacity", label: "Capacity", level: "unknown" })])).toContain("capacity");
  });
});

describe("the health report on a real event", () => {
  it("measures what it can, greys what it cannot, and never invents a capacity figure", async () => {
    const event = await createEventRecord({ name: "Health test", when: "later" }, owner);
    const report = await getEventHealthReport({ eventId: event.id });
    expect(report.signals.map((item) => item.key)).toEqual(["feed", "stage", "webhook", "fallback", "database", "chat", "attendees", "build", "capacity"]);
    // Every signal names where it came from, always.
    for (const item of report.signals) expect(item.source.length).toBeGreaterThan(0);
    // No signal may claim a level without a checked time behind it.
    for (const item of report.signals) if (item.level !== "unknown") expect(item.checkedAt).toBeTruthy();
    expect(report.signals.find((item) => item.key === "capacity")?.level).toBe("unknown");
    // Nothing told us which bundle asked, so the build signal cannot be green.
    expect(report.signals.find((item) => item.key === "build")?.level).toBe("unknown");
    expect(report.level).not.toBe("green");
  });

  it("survives a dead probe: one failed read greys one signal and leaves the other eight", async () => {
    const event = await createEventRecord({ name: "Dead probe", when: "later" }, owner);
    const store = (await import("@/services/runtime/runtimeStoreFactory")).getRuntimeStore();
    vi.spyOn(store, "listStageStreamEvents").mockRejectedValue(new Error("stage_stream_events is not migrated"));
    const report = await getEventHealthReport({ eventId: event.id });
    expect(report.signals).toHaveLength(9);
    expect(report.log).toEqual([]);
  });
});

describe("the event switcher lands on the same kind of page", () => {
  it("keeps the surface when the other event has one", () => {
    expect(switchEventPath("/crew/events/a", "a", "b")).toBe("/crew/events/b");
    expect(switchEventPath("/venue/a/stage", "a", "b")).toBe("/venue/b/stage");
    expect(switchEventPath("/app/events/a/publish", "a", "b")).toBe("/app/events/b/publish");
  });

  it("falls back to the other event's overview when the page belongs to a row of this one", () => {
    expect(switchEventPath("/venue/a/expo/booth-7", "a", "b")).toBe("/app/events/b");
    expect(switchEventPath("/app/events/a/sessions/s-1", "a", "b")).toBe("/app/events/b");
    expect(switchEventPath("/somewhere/else", "a", "b")).toBe("/app/events/b");
  });

  it("knows the five surfaces the bar belongs to", () => {
    for (const p of ["/app/events/a", "/crew/events/a/tasks", "/venue/a/lobby", "/speaker/events/a/green-room", "/sponsor/events/a"]) {
      expect(surfaceForPath(p, "a")).toBeDefined();
    }
    expect(surfaceForPath("/app/owner", "a")).toBeUndefined();
  });
});
