import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";

/**
 * The venue chrome is ONE pinned stack, measured in a real browser at both widths.
 *
 * The defect this holds shut, seen live by the owner on /venue/{eventId}/stage on 16 Sep 2026: the
 * Event Command Bar and the venue nav were two independently pinned bars. At rest they stacked and
 * the nav covered the "Stream credentials" heading; on scroll the nav slid up over the bar and hid
 * its controls; the nav itself ended mid-word at "Run of Sh"; and the event name was printed twice.
 *
 * Static analysis cannot see any of that, so this measures it: one pinned element on the page, the
 * bars never intersecting, the page content starting below the whole stack at rest AND after a
 * scroll, and the stack short enough on a 414px phone that the stage player still lands on the
 * first screen.
 *
 * Local file-store run only, like the other owner journeys: the owner gate needs the local day-1
 * password, and the demo event is the one seeded venue.
 */

const PHONE = { width: 414, height: 896 };
const DESKTOP = { width: 1440, height: 900 };

/** The 96px budget: two bars on a phone must still leave the video on the first screen. */
const PHONE_STACK_BUDGET = 96;

interface Box { x: number; y: number; width: number; height: number }

function intersects(a: Box, b: Box) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} must be on the page`).not.toBeNull();
  return box as Box;
}

/**
 * Every element the browser is actually pinning right now, by computed style. Not a class-name
 * guess. A closed menu panel is not painted, so it is not a pinned region of the page; only what a
 * viewer can see counts.
 */
async function pinnedElements(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((node) => {
        const position = getComputedStyle(node).position;
        if (position !== "sticky" && position !== "fixed") return false;
        // A menu that nobody has opened is not a pinned region of the page.
        if (node.closest("details:not([open])")) return false;
        return node.getClientRects().length > 0;
      })
      .map((node) => `${node.tagName.toLowerCase()}${node.getAttribute("data-chrome-stack") !== null ? "[data-chrome-stack]" : ""}.${(node.getAttribute("class") || "").split(" ").slice(0, 3).join(".")}`),
  );
}

async function assertOneStack(page: Page, label: string) {
  const pinned = await pinnedElements(page);
  expect(pinned, `${label}: exactly one element may be pinned, and it must be the chrome stack`).toHaveLength(1);
  expect(pinned[0], `${label}: the pinned element must be the chrome stack`).toContain("[data-chrome-stack]");
}

async function assertContentClearsStack(page: Page, label: string) {
  const stack = await boxOf(page, "[data-chrome-stack]");
  const content = await boxOf(page, "main");
  expect(content.y, `${label}: page content must begin below the whole stack, never underneath it`).toBeGreaterThanOrEqual(stack.y + stack.height - 1);
  expect(intersects(stack, { ...content, height: 1 }), `${label}: the stack must not sit over the top of the content`).toBe(false);
}

async function assertBarsDoNotOverlap(page: Page, label: string) {
  const bars = page.locator("[data-chrome-bar]");
  const count = await bars.count();
  expect(count, `${label}: the stack must carry at least the venue nav`).toBeGreaterThan(0);
  const boxes: Box[] = [];
  for (let i = 0; i < count; i += 1) {
    const box = await bars.nth(i).boundingBox();
    if (box) boxes.push(box);
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      expect(intersects(boxes[i], boxes[j]), `${label}: the bars in the stack must never overlap each other`).toBe(false);
    }
  }
}

async function loginAsOwner(page: Page, next: string) {
  await gotoAndAssert(page, `/production-access/owner?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await page.getByRole("button", { name: /enter owner workspace/i }).click();
  await page.waitForURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test.describe("the venue chrome is one pinned stack", () => {
  for (const [name, viewport] of [["phone 414px", PHONE], ["desktop 1440px", DESKTOP]] as const) {
    test(`an attendee sees one stack and content below it at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAndAssert(page, "/venue/demo/stage");
      await expect(page.locator("[data-chrome-stack]")).toBeVisible();
      await assertOneStack(page, name);
      await assertContentClearsStack(page, name);
      await assertBarsDoNotOverlap(page, name);

      // With no command bar the nav is the whole stack, so it keeps the event name, exactly once.
      await expect(page.locator("[data-chrome-bar='command']"), `${name}: an attendee must never see the command bar`).toHaveCount(0);
      await expect(page.locator("[data-chrome-event-name]"), `${name}: the event name renders once in the stack`).toHaveCount(1);
    });
  }

  test("the owner's two bars share one pin, never cover each other, and stay under the phone budget", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(PHONE);
    await loginAsOwner(page, "/venue/demo/stage");
    await expect(page.locator("[data-chrome-bar='command']"), "the owner must get the command bar").toHaveCount(1);

    await assertOneStack(page, "owner phone");
    await assertBarsDoNotOverlap(page, "owner phone");
    await assertContentClearsStack(page, "owner phone");

    // The command bar is the top of the stack and the nav is directly beneath it.
    const commandBar = await boxOf(page, "[data-chrome-bar='command']");
    const subBar = await boxOf(page, "[data-chrome-bar='venue-nav']");
    expect(subBar.y, "the venue nav is the sub-bar, below the command bar").toBeGreaterThanOrEqual(commandBar.y + commandBar.height - 1);

    // The name is printed once in the stack: the command bar names the event, the sub-bar drops it.
    await expect(page.locator("[data-chrome-event-name]"), "the sub-bar must drop the duplicated event name").toHaveCount(0);
    await expect(page.locator("[data-testid='command-bar-event-name']")).toHaveCount(1);

    // One live claim in the stack. The sub-bar no longer carries a pill of its own.
    await expect(page.locator("[data-testid='live-pill']")).toHaveCount(0);

    const stack = await boxOf(page, "[data-chrome-stack]");
    expect(stack.height, `the two bars on a 414px phone must stay under ${PHONE_STACK_BUDGET}px so the video lands on the first screen`).toBeLessThanOrEqual(PHONE_STACK_BUDGET);

    // The credentials scroll with the page: they are below the pin, not part of it.
    const credentials = page.locator("[data-testid='command-bar-credentials']");
    if (await credentials.count()) {
      const credentialsBox = await credentials.first().boundingBox();
      if (credentialsBox) expect(intersects(credentialsBox, stack), "the credentials panel must sit below the stack, not underneath it").toBe(false);
    }

    // A menu still opens, and lands on screen. Below xl the bar is one scrolling row, and a row
    // that scrolls would clip an absolutely positioned dropdown, so the panels are sheets instead.
    await page.getByTestId("command-bar-codes").locator("summary").click();
    const panel = page.getByTestId("command-bar-codes").locator("div").first();
    await expect(panel, "a menu opened off the scrolling bar must be visible, not clipped by it").toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox!.y + panelBox!.height, "the menu sheet must land inside the screen").toBeLessThanOrEqual(PHONE.height + 1);
    expect(panelBox!.x, "the menu sheet must land inside the screen").toBeGreaterThanOrEqual(0);
    await page.getByTestId("command-bar-codes").locator("summary").click();

    // On scroll the stack stays whole: the nav cannot slide up over the command bar, because there
    // is only one pin. This is the exact failure the owner reported.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(250);
    await assertBarsDoNotOverlap(page, "owner phone after scroll");
    const scrolledCommandBar = await boxOf(page, "[data-chrome-bar='command']");
    const scrolledSubBar = await boxOf(page, "[data-chrome-bar='venue-nav']");
    expect(scrolledCommandBar.y, "the command bar must still be at the top of the pinned stack after a scroll").toBeLessThan(scrolledSubBar.y + 1);
    expect(await pinnedElements(page), "a scroll must not reveal a second pinned bar").toHaveLength(1);
  });

  test("the stack stays shallow at desktop width too", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(DESKTOP);
    await loginAsOwner(page, "/venue/demo/stage");
    await assertOneStack(page, "owner desktop");
    await assertBarsDoNotOverlap(page, "owner desktop");
    await assertContentClearsStack(page, "owner desktop");
    const stack = await boxOf(page, "[data-chrome-stack]");
    // One row of controls and one row of nav. It was two bars of 56px and 64px before.
    expect(stack.height, "the stack must stay a thin band at desktop width").toBeLessThanOrEqual(96);
  });

  test("the nav never renders clipped without saying it scrolls", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoAndAssert(page, "/venue/demo/stage");
    const fits = await page.evaluate(() => {
      const scroller = document.querySelector("[data-nav-scroller]") as HTMLElement | null;
      if (!scroller) return null;
      return { overflow: scroller.scrollWidth - scroller.clientWidth, fadeVisible: Boolean((document.querySelector("[data-nav-overflow-fade]") as HTMLElement | null)?.offsetParent) };
    });
    expect(fits, "the venue nav must be on the page").not.toBeNull();
    // Preference order: at desktop the row is made to fit rather than scrolled.
    expect(fits!.overflow, "the whole nav must fit at 1440px; it must not be silently clipped").toBeLessThanOrEqual(1);

    await page.setViewportSize(PHONE);
    await page.waitForTimeout(250);
    const phone = await page.evaluate(() => {
      const scroller = document.querySelector("[data-nav-scroller]") as HTMLElement | null;
      const fade = document.querySelector("[data-nav-overflow-fade]") as HTMLElement | null;
      return {
        overflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
        scrollable: scroller ? getComputedStyle(scroller).overflowX : "",
        fadeVisible: Boolean(fade && fade.offsetParent !== null && fade.getBoundingClientRect().width > 0),
      };
    });
    expect(phone.scrollable, "on a phone the nav scrolls rather than clipping").toMatch(/auto|scroll/);
    if (phone.overflow > 1) {
      expect(phone.fadeVisible, "a row that runs past the edge must show the fade that says so").toBe(true);
    }
  });
});
