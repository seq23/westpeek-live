import { expect, test, type Page } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";

/**
 * The stream credentials panel hangs under the pinned command bar and the page carries on below
 * it. In the event workspace at 390px it sat flush on the "All event pages" card (0px apart), so
 * its rounded foot ran into the card and the two read as one broken bar (#119 review, 22 Nov 2026).
 */
async function loginAsOwner(page: Page, next: string) {
  await gotoAndAssert(page, `/production-access/owner?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await page.getByRole("button", { name: /enter owner workspace/i }).click();
  await page.waitForURL(/\/app\/events\/demo\/assets/);
}

test.describe("the stream credentials panel keeps clear of the page under it", () => {
  for (const width of [320, 390]) {
    test(`event workspace at ${width}px: a gap between the panel and the next card, and nothing past the edge`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await loginAsOwner(page, "/app/events/demo/assets");
      const panel = page.getByTestId("command-bar-credentials");
      const next = page.getByTestId("spine-drawer");
      await expect(panel, "the owner must get the credentials panel").toHaveCount(1);
      await expect(next).toBeVisible();
      const [p, n] = [await panel.boundingBox(), await next.boundingBox()];
      expect(p && n, "both measured").toBeTruthy();
      expect(n!.y - (p!.y + p!.height), "space between the panel's foot and the next card").toBeGreaterThanOrEqual(12);
      expect(p!.x + p!.width, "panel inside the screen").toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), "no sideways scroll").toBeLessThanOrEqual(width);
    });
  }
});
