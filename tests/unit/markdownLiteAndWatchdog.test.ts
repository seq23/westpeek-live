import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { markdownHeadings, markdownSlug } from "@/lib/markdown/markdownOutline";
import { buildChanged, typingInProgress } from "@/lib/runtime/buildVersion";

/**
 * The manual renderer and the deploy watchdog. The owner kept an Owner Console open across a
 * deploy and it went on serving the old bundle until she hard-refreshed; the page that was open had
 * no poller at all (it predated one), and a tab that has been in the background should not wait
 * another half minute after she comes back to it.
 */
describe("markdown-lite", () => {
  it("finds the sections for the spine and slugs them the way the anchors do", () => {
    const headings = markdownHeadings("# Title\n\n## First section\n\n### Nested\n\ntext\n\n## Second **section**\n");
    expect(headings.map((heading) => heading.text)).toEqual(["First section", "Nested", "Second section"]);
    expect(headings[0].id).toBe("first-section");
    expect(markdownSlug("5. Access codes — how they work")).toBe("5-access-codes-how-they-work");
  });

  it("the real manual has sections and screenshots that point at public/", () => {
    const generated = fs.readFileSync("lib/manual/manualSource.generated.ts", "utf8");
    const MANUAL_SOURCE = JSON.parse(generated.slice(generated.indexOf("MANUAL_SOURCE = ") + "MANUAL_SOURCE = ".length, generated.indexOf(";\nexport const MANUAL_IMAGES"))) as string;
    const MANUAL_IMAGES = JSON.parse(generated.slice(generated.indexOf("MANUAL_IMAGES = ") + "MANUAL_IMAGES = ".length, generated.lastIndexOf(";"))) as string[];
    expect(markdownHeadings(MANUAL_SOURCE).length).toBeGreaterThan(5);
    expect(MANUAL_IMAGES.length).toBeGreaterThan(0);
    for (const image of MANUAL_IMAGES) expect(fs.existsSync(`public/manual/images/${image}`)).toBe(true);
    expect(MANUAL_SOURCE).not.toMatch(/\]\(docs\/images/);
  });
});

describe("the deploy watchdog", () => {
  it("only fires when both builds are known and different", () => {
    expect(buildChanged("abc", "def")).toBe(true);
    expect(buildChanged("abc", "abc")).toBe(false);
    expect(buildChanged(undefined, "def")).toBe(false);
    expect(buildChanged("abc", null)).toBe(false);
  });

  it("never reloads while something is being typed", () => {
    const withText = { querySelectorAll: () => [{ value: "half a message" }] };
    const empty = { querySelectorAll: () => [{ value: "   " }] };
    expect(typingInProgress(withText)).toBe(true);
    expect(typingInProgress(empty)).toBe(false);
  });

  it("asks again when the tab comes back, not only on a timer", () => {
    const poller = fs.readFileSync("components/system/BuildVersionPoller.tsx", "utf8");
    for (const event of ["focus", "pageshow", "visibilitychange"]) expect(poller).toContain(event);
    expect(poller).toContain("intervalMs = 30_000");
    // And it is mounted where the owner actually sits.
    expect(fs.readFileSync("components/layout/AppShell.tsx", "utf8")).toContain("BuildVersionPoller");
    expect(fs.readFileSync("app/crew/events/[eventId]/layout.tsx", "utf8")).toContain("BuildVersionPoller");
  });
});
