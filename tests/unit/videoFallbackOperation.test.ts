import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { clearRoomFallbackOverride, getRoomFallbackState, switchRoomFallback } from "@/services/video/roomFallbackService";

describe("video fallback operation", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wpl-fallback-"));
    setRuntimeStoreForTests(new FileRuntimeStore(join(dir, "runtime.json")));
  });

  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    rmSync(dir, { recursive: true, force: true });
  });

  it("requires crew confirmation for Zoom", async () => {
    const state = await getRoomFallbackState("event-summit", "main_stage");
    await expect(switchRoomFallback({ state, provider: "zoom", confirmedByCrew: false })).rejects.toThrow(/confirmation/);
  });

  it("switches and rolls back when confirmed", async () => {
    const state = await getRoomFallbackState("event-summit", "main_stage");
    const switched = await switchRoomFallback({ state, provider: "zoom", confirmedByCrew: true });
    expect(switched.activeProvider).toBe("zoom");
    const rolledBack = await clearRoomFallbackOverride(switched);
    expect(rolledBack.activeProvider).toBe("livekit");
  });
});
