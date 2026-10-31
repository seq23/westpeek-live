import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { listEventIncidents, logIncident, recordAutomaticIncident, setIncidentStatus, validateIncidentInput } from "@/services/incidents/incidentLog";
import { applyStageStreamSignal, stageStreamIncident } from "@/services/video/stageStreamStateService";
import type { StageStreamState } from "@/types/stageStream";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The incident log is a real per-event log (30 Oct 2026). Before, the page printed two fixed sample
 * incidents on every event, one of them "Daily fallback verified" on events where Daily was off.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("incident entry rules", () => {
  it("needs a few words about what happened and a real severity", () => {
    expect(validateIncidentInput({ eventId: "e", title: "  ", severity: "high", reportedBy: "Owner" })).toMatchObject({ ok: false, error: "Say what happened in a few words." });
    expect(validateIncidentInput({ eventId: "e", title: "Audio hum", severity: "apocalyptic", reportedBy: "Owner" })).toMatchObject({ ok: false });
    expect(validateIncidentInput({ eventId: "", title: "Audio hum", severity: "low", reportedBy: "Owner" })).toMatchObject({ ok: false });
  });

  it("is open unless the person says it is already resolved, and is marked as logged by a person", () => {
    const open = validateIncidentInput({ eventId: "e", title: "Audio hum", severity: "low", reportedBy: "Producer" });
    expect(open).toMatchObject({ ok: true, value: { status: "open", source: "manual", reportedBy: "Producer", severity: "low" } });
    const done = validateIncidentInput({ eventId: "e", title: "Audio hum", severity: "low", status: "resolved", reportedBy: "Producer" });
    expect(done).toMatchObject({ ok: true, value: { status: "resolved" } });
  });
});

describe("the incident store, per event", () => {
  let tempDir: string;
  let eventId: string;
  let otherEventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-incidents-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "Incident Summit", when: "now" }, owner)).id;
    otherEventId = (await createEventRecord({ name: "Other Summit", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a new event has an empty log — no sample incidents", async () => {
    expect(await listEventIncidents(eventId)).toEqual([]);
  });

  it("logs, lists newest first, resolves and reopens, and never leaks into another event", async () => {
    const first = await logIncident({ eventId, title: "Slides froze", severity: "medium", reportedBy: "Producer" }, new Date("2026-10-30T18:00:00.000Z"));
    const second = await logIncident({ eventId, title: "Speaker late", severity: "high", details: "Joined 4 minutes after cue", reportedBy: "Show Caller" }, new Date("2026-10-30T18:05:00.000Z"));
    const list = await listEventIncidents(eventId);
    expect(list.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(list[0]).toMatchObject({ title: "Speaker late", severity: "high", status: "open", source: "manual", reportedBy: "Show Caller", details: "Joined 4 minutes after cue" });
    expect(await listEventIncidents(otherEventId)).toEqual([]);

    const resolved = await setIncidentStatus(eventId, first.id, "resolved", new Date("2026-10-30T18:10:00.000Z"));
    expect(resolved).toMatchObject({ status: "resolved", resolvedAt: "2026-10-30T18:10:00.000Z" });
    const reopened = await setIncidentStatus(eventId, first.id, "open", new Date("2026-10-30T18:12:00.000Z"));
    expect(reopened).toMatchObject({ status: "open" });
    expect(reopened?.resolvedAt).toBeUndefined();
    // Another event cannot resolve this event's incident.
    expect(await setIncidentStatus(otherEventId, second.id, "resolved")).toBeUndefined();
    expect((await listEventIncidents(eventId)).find((item) => item.id === second.id)?.status).toBe("open");
  });

  it("refuses an entry with no description rather than storing an empty row", async () => {
    await expect(logIncident({ eventId, title: "", severity: "low", reportedBy: "Owner" })).rejects.toThrow("Say what happened");
    expect(await listEventIncidents(eventId)).toEqual([]);
  });

  it("the app logs one automatic incident when the main stage moves to a backup path, and not twice for a repeat", async () => {
    await applyStageStreamSignal({ eventId, signal: "manual_switch_to_zoom", reason: "Daily failed." });
    const after = await listEventIncidents(eventId);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ source: "automatic", status: "open", severity: "high" });
    expect(after[0].title).toContain("backup path: Zoom");
    expect(await recordAutomaticIncident({ eventId, title: after[0].title, details: "again", severity: "high" })).toBeUndefined();
    expect(await listEventIncidents(eventId)).toHaveLength(1);
  });

  it("rows written before migration 0007 (no source) read as logged by a person", async () => {
    await getRuntimeStore().appendIncident({ id: "legacy-1", eventId, title: "Old row", severity: "low", status: "open", ownerRole: "crew", details: "", createdAt: "2026-10-01T00:00:00.000Z" });
    expect((await listEventIncidents(eventId))[0]).toMatchObject({ id: "legacy-1", source: "manual" });
  });
});

describe("which stage transitions become incidents", () => {
  const base = { eventId: "e", stageId: "main-stage", activeStreamSource: "LIVEKIT_INGRESS", failurePlane: "NONE", streamStatus: "LIVEKIT_INGRESS_LIVE", operatorMarkedShowEnded: false } as unknown as StageStreamState;
  it("a move to a backup path is one", () => {
    expect(stageStreamIncident(base, { ...base, activeStreamSource: "CLOUDFLARE_STREAM" } as StageStreamState, "feed dropped")).toMatchObject({ severity: "high", title: "Main stage moved to a backup path: Cloudflare Stream" });
  });
  it("a new failure on the stream is one", () => {
    expect(stageStreamIncident(base, { ...base, failurePlane: "PRIMARY_PIPELINE_TOTAL_FAILURE" } as StageStreamState, "no ingest")).toMatchObject({ severity: "critical" });
  });
  it("moving back to the main stream, an intentional end, or no change are not", () => {
    expect(stageStreamIncident({ ...base, activeStreamSource: "DAILY" } as StageStreamState, base, "restored")).toBeUndefined();
    expect(stageStreamIncident(base, { ...base, activeStreamSource: "DAILY", operatorMarkedShowEnded: true } as StageStreamState, "ended")).toBeUndefined();
    expect(stageStreamIncident(base, base, "heartbeat")).toBeUndefined();
  });
});

describe("the incident page has no sample rows left in it", () => {
  it("reads the event's own log and says so plainly when it is empty", () => {
    const source = fs.readFileSync("components/production/IncidentLog.tsx", "utf8") + fs.readFileSync("components/production/IncidentPanel.tsx", "utf8");
    expect(source).toContain("listEventIncidents(eventId)");
    expect(source).toContain("No incidents logged for this event.");
    expect(source).not.toMatch(/const incidents = \[/);
    expect(source).not.toContain("Daily fallback verified");
  });
});
