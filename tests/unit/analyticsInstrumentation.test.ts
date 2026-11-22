import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { recordAnalyticsEvent } from "@/services/analytics/analyticsEventService";

describe("analytics instrumentation", () => {
  let dir: string;
  let store: FileRuntimeStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wpl-analytics-"));
    store = new FileRuntimeStore(join(dir, "runtime.json"));
    setRuntimeStoreForTests(store);
  });

  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists required analytics events to the runtime store", async () => {
    await recordAnalyticsEvent({ eventId: "event-summit", kind: "attendee_joined_lobby" });
    await recordAnalyticsEvent({ eventId: "event-summit", kind: "sponsor_cta_clicked", subjectId: "sponsor-1" });
    const { analyticsEvents } = await store.readSnapshot();
    expect(analyticsEvents.map((event) => event.kind)).toEqual(["attendee_joined_lobby", "sponsor_cta_clicked"]);
  });
});
