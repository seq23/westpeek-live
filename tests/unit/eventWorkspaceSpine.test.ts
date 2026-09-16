import { describe, expect, it } from "vitest";
import { EVENT_SPINE, SPINE_REDIRECTS, spineEntries, spineHref } from "@/lib/navigation/eventWorkspaceSpine";

/**
 * The spine is the event workspace's only navigation map: one entry per page, one group per way of
 * working, and the pages that existed twice redirect instead of competing.
 */
describe("event workspace spine", () => {
  it("groups the work and never lists a page twice", () => {
    expect(EVENT_SPINE.map((group) => group.id)).toEqual(["overview", "plan", "people", "comms", "show-day", "after", "publish"]);
    const paths = spineEntries().map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("");
    expect(paths.length).toBeGreaterThanOrEqual(25);
  });

  it("every merged duplicate points at a page that is in the spine", () => {
    for (const [from, to] of Object.entries(SPINE_REDIRECTS)) {
      expect(spineEntries().some((entry) => entry.path === to)).toBe(true);
      expect(spineEntries().some((entry) => entry.path === from)).toBe(false);
    }
  });

  it("readiness is declared only where something is measured", () => {
    const measured = spineEntries().filter((entry) => entry.readiness).map((entry) => entry.readiness);
    expect(new Set(measured)).toEqual(new Set(["speakers", "run-of-show", "publish"]));
  });

  it("hrefs are event-scoped, and the root entry is the event's own page", () => {
    expect(spineHref("ada-summit", "")).toBe("/app/events/ada-summit");
    expect(spineHref("ada-summit", "run-of-show")).toBe("/app/events/ada-summit/run-of-show");
    expect(spineHref("ada-summit", "video/main-stage")).toBe("/app/events/ada-summit/video/main-stage");
  });
});
