import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Three things the production e2e of 16 Sep 2026 caught on the producer surfaces. Each is pinned.
 */

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { formatEventDate } from "@/lib/utils/format";
import { crewCallTimesFor, crewBriefing } from "@/lib/crew/crewBriefing";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { SupabaseRuntimeStore } from "@/services/runtime/supabaseRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { applyStageStreamSignal } from "@/services/video/stageStreamStateService";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Sequoia Taylor / owner", role: "owner" };

// 6:00 AM America/Chicago on 23 Sep 2026 (CDT, UTC-5) — the Later event from the e2e.
const SIX_AM_CHICAGO = "2026-09-23T11:00:00.000Z";

describe("1. producer surfaces show the event's clock, never a bare UTC time", () => {
  it("formats in the event's IANA zone when one is given", () => {
    expect(formatEventDate(SIX_AM_CHICAGO, "America/Chicago")).toBe("Sep 23, 6:00 AM");
    expect(formatEventDate(SIX_AM_CHICAGO, "America/New_York")).toBe("Sep 23, 7:00 AM");
    expect(formatEventDate(SIX_AM_CHICAGO, "UTC")).toBe("Sep 23, 11:00 AM");
  });
  it("names the zone when none is known, so 11:00 AM is never secretly UTC", () => {
    const out = formatEventDate(SIX_AM_CHICAGO);
    expect(out).toMatch(/^Sep 2\d, \d{1,2}:\d\d [AP]M [A-Z]{2,5}(?:[+-]\d+)?$/);
    expect(out).not.toBe("Sep 23, 11:00 AM");
  });
  it("an unknown zone name still says which clock it is; garbage is returned as given", () => {
    expect(formatEventDate(SIX_AM_CHICAGO, "Mars/Olympus_Mons")).toMatch(/[AP]M [A-Z]/);
    expect(formatEventDate("garbage", "America/Chicago")).toBe("garbage");
  });
  it("every producer call site passes the event zone", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const root = new URL("../../components/", import.meta.url);
    const files: string[] = [];
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(name)) files.push(p); } };
    walk(root.pathname);
    const bare = files.flatMap((file) => (readFileSync(file, "utf8").match(/formatEventDate\([^)]*\)/g) || []).filter((call) => !/,/.test(call)).map((call) => `${path.basename(file)}: ${call}`));
    expect(files.length).toBeGreaterThan(10);
    expect(bare).toEqual([]);
  });
});

describe("2. the crew briefing derives call time and show start from a runtime event", () => {
  const runtime = { startAt: SIX_AM_CHICAGO, timezone: "America/Chicago", source: "runtime" };
  it("call time is start minus 60 minutes, both in the event's zone with the zone named", () => {
    const times = crewCallTimesFor(runtime);
    expect(times.source).toBe("runtime");
    expect(times.showStart).toBe("Sep 23, 6:00 AM CDT");
    expect(times.callTime).toBe("Sep 23, 5:00 AM CDT");
    expect(times.callTime).not.toContain("local event time");
  });
  it("keeps the seed text for seed events and when no event is hydrated", () => {
    expect(crewCallTimesFor(undefined)).toEqual({ callTime: crewBriefing.callTime, showStart: crewBriefing.showStart, source: "seed" });
    expect(crewCallTimesFor({ ...runtime, source: "seed" }).callTime).toBe("9:00 AM local event time");
  });
  it("the shell and the call sheet no longer print the seed strings directly", async () => {
    const shell = fs.readFileSync(new URL("../../components/crew/CrewInstructionShell.tsx", import.meta.url), "utf8");
    const sheet = fs.readFileSync(new URL("../../app/crew/events/[eventId]/call-sheet/page.tsx", import.meta.url), "utf8");
    for (const src of [shell, sheet]) {
      expect(src).not.toMatch(/crewBriefing\.callTime/);
      expect(src).not.toMatch(/crewBriefing\.showStart/);
      expect(src).toMatch(/crewCallTimesFor\(/);
    }
  });
});

describe("3. the fallback event log lists a runtime event's stage stream events", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-cosmetics-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    delete process.env.AGENCY_EVENT_OS_RUNTIME_STORE;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("file store: filtered by event and stage, newest first, capped — after a thousand older rows", async () => {
    const store = new FileRuntimeStore(path.join(tempDir, "runtime.json"));
    setRuntimeStoreForTests(store);
    // The seed demo's history fills the table first, as it had in production.
    for (let i = 0; i < 1000; i += 1) {
      await store.appendStageStreamEvent({ id: `seed-${i}`, eventId: "event-summit", stageId: "main-stage", signal: "ingress_started", nextSource: "LIVEKIT_INGRESS", failurePlane: "NONE", message: `seed ${i}`, createdAt: new Date(Date.UTC(2026, 5, 1, 0, i)).toISOString() });
    }
    const event: RuntimeEventRecord = await createEventRecord({ name: `Cosmetics ${Date.now()}`, when: "now" }, owner);
    await applyStageStreamSignal({ eventId: event.id, signal: "generate_credentials" });
    await applyStageStreamSignal({ eventId: event.id, signal: "ingress_started", webhookEvent: "ingress_started" });
    await applyStageStreamSignal({ eventId: event.id, signal: "ingress_ended", webhookEvent: "ingress_ended" });

    const listed = await store.listStageStreamEvents(event.id, "main-stage", 8);
    expect(listed.map((e) => e.signal)).toEqual(["ingress_ended", "ingress_started", "generate_credentials"]);
    expect(listed.every((e) => e.eventId === event.id && e.stageId === "main-stage")).toBe(true);
    expect((await store.listStageStreamEvents(event.id, "main-stage", 2)).length).toBe(2);
    expect(await store.listStageStreamEvents(event.id, "breakout-a", 8)).toEqual([]);
    // Negative: the old path — the whole snapshot filtered in the component — is what the console must not do.
    const panel = fs.readFileSync(new URL("../../components/testing/StreamYardIngressPanel.tsx", import.meta.url), "utf8");
    expect(panel).not.toMatch(/readSnapshot\(\)/);
    expect(panel).toMatch(/listStageStreamEvents\(eventId, "main-stage", 8\)/);
  });

  it("supabase adapter: the query is filtered by event_id and stage_id at the database, newest first, limited", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const rows = [{ state_event: { id: "a", eventId: "evt", stageId: "main-stage", signal: "ingress_ended", nextSource: "ENDED", failurePlane: "NONE", message: "", createdAt: "2026-09-16T02:00:00.000Z" } }];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) chain[method] = (...args: unknown[]) => { calls.push([method, args]); return chain; };
    (chain as { then: (resolve: (value: unknown) => void) => void }).then = (resolve) => resolve({ data: rows, error: null });
    const client = { from: (table: string) => { calls.push(["from", [table]]); return chain; } };
    const store = new SupabaseRuntimeStore(client as never);
    const listed = await store.listStageStreamEvents("evt", "main-stage", 8);
    expect(listed.map((e) => e.signal)).toEqual(["ingress_ended"]);
    expect(calls).toEqual([
      ["from", ["stage_stream_events"]],
      ["select", ["state_event"]],
      ["eq", ["event_id", "evt"]],
      ["eq", ["stage_id", "main-stage"]],
      ["order", ["created_at", { ascending: false }]],
      ["limit", [8]],
    ]);
  });
});
