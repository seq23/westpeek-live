import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Archiving from the Owner Console must be the SAME archive the event page does — the one that also
 * releases the LiveKit ingress — and it must be reversible. A second implementation would drift.
 */
const released: string[] = [];
vi.mock("@/services/video/livekitIngressService", () => ({
  releaseIngressForEvent: async (eventId: string) => { released.push(eventId); return { released: true }; },
}));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { archiveEventRecord, createEventRecord, listEventRecords, restoreEventRecord } from "@/services/events/eventRepository";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("archive and restore from the console", () => {
  let tempDir: string;
  beforeEach(() => {
    released.length = 0;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-archive-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("archiving releases the stage and takes the event out of the working lists; restoring brings it back", async () => {
    const event = await createEventRecord({ name: "Console Archive Room", when: "now" }, owner);
    expect(event.status).toBe("live");
    await archiveEventRecord(event.id, owner);
    expect(released).toContain(event.id);
    const working = await listEventRecords();
    expect(working.some((row) => row.id === event.id)).toBe(false);
    const withArchived = await listEventRecords({ includeArchived: true });
    expect(withArchived.find((row) => row.id === event.id)?.status).toBe("archived");
    await restoreEventRecord(event.id, owner);
    const restored = await listEventRecords();
    expect(restored.find((row) => row.id === event.id)?.status).toBe("live");
  });

  it("the console's control uses that path rather than a second implementation", () => {
    const control = fs.readFileSync("components/owner/EventArchiveControl.tsx", "utf8");
    expect(control).toContain("archiveEventAction");
    expect(control).toContain("restoreEventAction");
    expect(control).toContain("window.confirm");
    expect(control).toContain("restore it from the Archived group");
    const console_ = fs.readFileSync("components/owner/OwnerConsole.tsx", "utf8");
    expect(console_).toContain("EventArchiveControl");
    expect(console_).toContain("listEventRecords({ includeArchived: true })");
    expect(console_).toContain('["Live", live]');
  });
});
