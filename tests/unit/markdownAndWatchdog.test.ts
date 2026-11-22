import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { markdownHeadings, markdownSlug } from "@/lib/markdown/markdownOutline";
import { buildChanged, typingInProgress } from "@/lib/runtime/buildVersion";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/lib/markdown/Markdown";

const render = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }));

/**
 * The manual renderer and the deploy watchdog. The owner kept an Owner Console open across a
 * deploy and it went on serving the old bundle until she hard-refreshed; the page that was open had
 * no poller at all (it predated one), and a tab that has been in the background should not wait
 * another half minute after she comes back to it.
 */
describe("the manual renderer (react-markdown)", () => {
  it("a document's raw HTML is shown as text, never run", () => {
    const html = render('Hello <script>alert(1)</script> and <img src=x onerror="alert(2)">\n\n<iframe src="https://example.com"></iframe>\n');
    expect(html).not.toMatch(/<script|<img src="x"|<iframe/);
    expect(html).not.toContain("onerror=\"alert");
  });

  it("renders what the hand parser dropped: italics, nested lists, a link with parentheses, multi-line list items", () => {
    const html = render("Read *this* first.\n\n- Top\n  - Nested\n- Second\n  continues here\n\nSee [the docs](https://example.com/a_(b)).\n");
    expect(html).toContain("<em>this</em>");
    expect(html).toMatch(/<li>Top\s*<ul[^>]*>\s*<li>Nested<\/li>/);
    expect(html).toContain('href="https://example.com/a_(b)"');
    expect(html).toMatch(/Second\s+continues here/);
  });

  it("headings carry the anchors the spine links to, and tables render", () => {
    const html = render("## First section\n\n### Second **section**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
    expect(html).toContain('id="first-section"');
    expect(html).toContain('id="second-section"');
    expect(html).toMatch(/<table[^>]*>[\s\S]*<td[^>]*>1<\/td>/);
  });


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

describe("house style at render time", () => {
  it("a page never shows an em dash, whoever wrote one into the source; code is left as written", () => {
    const source = "# Go live — now\n\nOpen the room — then wait for **crew — ready** and [the guide — here](/x).\n\n- — a bullet\n\n| a — b |\n|---|\n| c—d |\n\nRun `a—b` exactly.\n\n```\nkeep — this\n```\n";
    const html = render(source);
    const outsideCode = html.replace(/<code[^>]*>[\s\S]*?<\/code>/g, "");
    expect(outsideCode).not.toContain("—");
    expect(html).toContain("Open the room, then wait for");
    expect(html).toContain("crew, ready");
    expect(html).toContain("a—b");
    expect(html).toContain("keep — this");
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
