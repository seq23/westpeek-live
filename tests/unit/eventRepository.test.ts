import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { archiveEventRecord, createEventRecord, findEventRecord, listEventRecords, restoreEventRecord, setEventStatus } from "@/services/events/eventRepository";
import { ensureRuntimeEvent, peekOverlayEvent, resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { resolveEventJoinCode } from "@/services/events/eventStateResolver";
import { resolveCrewAccess, resolveSpecialGuestAccess } from "@/services/access/eventAccessResolver";
import { getEventConfig, getEventConfigPackage } from "@/services/events/eventConfigRepository";
import { getEvent, getRuntimeData, getSessionsForEvent } from "@/lib/runtime/getRuntimeData";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Sequoia Taylor / owner", role: "owner" };

describe("runtime-first event repository", () => {
  let tempDir: string;
  const originalStore = process.env.AGENCY_EVENT_OS_RUNTIME_STORE;
  const originalCrew = process.env.CREW_ACCESS_PASSWORD;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-runtime-events-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    process.env.CREW_ACCESS_PASSWORD = "global-crew-password-for-tests";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });

  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    resetOverlayForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (originalStore === undefined) delete process.env.AGENCY_EVENT_OS_RUNTIME_STORE;
    else process.env.AGENCY_EVENT_OS_RUNTIME_STORE = originalStore;
    if (originalCrew === undefined) delete process.env.CREW_ACCESS_PASSWORD;
    else process.env.CREW_ACCESS_PASSWORD = originalCrew;
  });

  it("NOW creates a live event with a join code, access codes, and one main-stage session", async () => {
    const event = await createEventRecord({ name: "Founder Office Hours", when: "now", format: "stage" }, owner);
    expect(event.status).toBe("live");
    expect(event.slug).toBe("founder-office-hours");
    expect(event.joinCode).toMatch(/^wpl-[a-z0-9]{6}$/);
    expect(event.accessCodes.crew).toMatch(/^CREW-/);
    expect(event.accessCodes.speaker).toMatch(/^SPK-/);
    expect(event.accessCodes.client).toMatch(/^CLT-/);
    expect(event.sessions).toHaveLength(1);
    expect(event.createdByLabel).toBe("Sequoia Taylor / owner");
    expect(event.clientName).toBe("West Peek");

    const stored = await findEventRecord(event.joinCode);
    expect(stored?.id).toBe(event.id);
    expect((await findEventRecord(event.slug))?.id).toBe(event.id);
  });

  it("LATER creates a draft that /join refuses until it is published", async () => {
    const event = await createEventRecord({ name: "Acme Town Hall", when: "later", clientName: "Acme Health", startAt: "2027-01-05T15:00:00.000Z", eventType: "internal_town_hall" }, owner);
    expect(event.status).toBe("draft");
    expect(event.clientName).toBe("Acme Health");
    expect(event.clientId).toBe("acme-health");

    const closed = await resolveEventJoinCode(event.joinCode);
    expect(closed.ok).toBe(false);
    expect(closed.reason).toBe("not_public");

    await setEventStatus(event.id, "registration_open", owner);
    const open = await resolveEventJoinCode(event.joinCode);
    expect(open.ok).toBe(true);
    expect(open.destination).toBe(`/events/${event.slug}`);

    await setEventStatus(event.id, "live", owner);
    const live = await resolveEventJoinCode(event.joinCode);
    expect(live.ok).toBe(true);
    expect(live.destination).toBe(`/venue/${event.id}/stage`); // live means the stage, not a lobby one click short of it
  });

  it("archives (hidden by default) and restores to the pre-archive status", async () => {
    const event = await createEventRecord({ name: "Archive Me", when: "now" }, owner);
    await archiveEventRecord(event.id, owner);
    expect((await listEventRecords()).some((item) => item.id === event.id)).toBe(false);
    expect((await listEventRecords({ includeArchived: true })).find((item) => item.id === event.id)?.status).toBe("archived");
    const archivedJoin = await resolveEventJoinCode(event.joinCode);
    expect(archivedJoin.ok).toBe(false);
    expect(archivedJoin.reason).toBe("archived");

    const restored = await restoreEventRecord(event.id, owner);
    expect(restored.status).toBe("live");
    expect((await listEventRecords()).some((item) => item.id === event.id)).toBe(true);
  });

  it("keeps the compiled seed events resolving and marks them as seed", async () => {
    const demo = await findEventRecord("demo");
    expect(demo?.source).toBe("seed");
    expect(demo?.id).toBe("event-summit");
    const list = await listEventRecords({ includeSeed: true });
    expect(list.filter((item) => item.source === "seed")).toHaveLength(5);
    expect((await listEventRecords()).filter((item) => item.source === "seed")).toHaveLength(0);
  });

  it("hydrates the sync config repository and read model through the overlay", async () => {
    const event = await createEventRecord({ name: "Overlay Check", when: "now", format: "room" }, owner);
    expect(getEventConfig(event.id)).toBeUndefined();
    await ensureRuntimeEvent(event.id);
    expect(peekOverlayEvent(event.joinCode)?.id).toBe(event.id);
    expect(getEventConfig(event.id)?.name).toBe("Overlay Check");
    expect(getEventConfigPackage(event.id).agenda.sessions).toHaveLength(1);
    expect(getEvent(event.id).name).toBe("Overlay Check");
    expect(getSessionsForEvent(event.id)).toHaveLength(1);
    expect(getRuntimeData().events[0]?.id).toBe(event.id);
  });

  it("gates crew and special guests with the codes minted for that event", async () => {
    const event = await createEventRecord({ name: "Gated Show", when: "now" }, owner);
    const speaker = await resolveSpecialGuestAccess(event.joinCode, event.accessCodes.speaker);
    expect(speaker.ok).toBe(true);
    expect(speaker.role).toBe("speaker");
    expect(speaker.destination).toBe(`/speaker/events/${event.id}`);

    const wrong = await resolveSpecialGuestAccess(event.joinCode, "SPK-NOPE");
    expect(wrong.ok).toBe(false);
    expect(wrong.reason).toBe("invalid_role_code");

    const crewByEventCode = await resolveCrewAccess(event.joinCode, "crew", event.accessCodes.crew);
    expect(crewByEventCode.ok).toBe(true);
    expect(crewByEventCode.destination).toBe(`/crew/events/${event.id}`);

    const crewByGlobal = await resolveCrewAccess(event.slug, "crew", "global-crew-password-for-tests");
    expect(crewByGlobal.ok).toBe(true);

    const crewWrong = await resolveCrewAccess(event.slug, "crew", "nope");
    expect(crewWrong.ok).toBe(false);
    expect(crewWrong.reason).toBe("invalid_password");
  });

  it("never lets a runtime slug shadow a seed event", async () => {
    const event = await createEventRecord({ name: "demo", when: "now" }, owner);
    expect(event.slug).not.toBe("demo");
    expect((await findEventRecord("demo"))?.source).toBe("seed");
  });
});
