import { expect, test } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";

function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

test.use({ viewport: { width: 390, height: 844 } });

test("mobile venue pages do not render a floating global brand overlay", async ({ page }) => {
  for (const route of ["/venue/demo/lobby", "/venue/demo/stage", "/events/demo/register", "/production-access/operator"]) {
    await gotoAndAssert(page, route);
    const globalLogo = page.locator("a[aria-label='West Peek Productions home']");
    await expect(globalLogo, `${route} must not render the old fixed WP overlay`).toHaveCount(0);
  }
});

test("mobile stage keeps Help/legal/brand elements away from player, chat, and header", async ({ page }) => {
  await gotoAndAssert(page, "/venue/demo/stage");

  const criticalSelectors = [
    "header",
    "section:has-text('Main stage')",
    "[data-testid='main-stage-chat-input']",
    "textarea",
    "input",
  ];

  const floatingHelp = page.locator("[data-testid='floating-event-help']");
  await expect(floatingHelp, "floating event help should not render over active stage").toHaveCount(0);

  const brandLegalLinks = page.locator("a", { hasText: /West Peek Live|West Peek Productions|Privacy|Terms|Support/i });
  const criticalBoxes = [];

  for (const selector of criticalSelectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      const box = await locator.boundingBox();
      if (box) criticalBoxes.push({ selector, box });
    }
  }

  const count = await brandLegalLinks.count();
  for (let i = 0; i < count; i += 1) {
    const link = brandLegalLinks.nth(i);
    const linkBox = await link.boundingBox();
    if (!linkBox) continue;
    for (const critical of criticalBoxes) {
      expect(intersects(linkBox, critical.box), `brand/legal link must not overlap ${critical.selector}`).toBe(false);
    }
  }
});
