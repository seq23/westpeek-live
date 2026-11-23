import { expect, test, type Page } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { HOW_IT_WORKS_AUDIENCES } from "@/types/howItWorks";

/**
 * The manual and every how-it-works page fit a 320px phone: nothing in the rendered document
 * (a long link, a path in bold) pushes the page sideways. Seen on /how-it-works/crew, 22 Nov 2026,
 * where westpeek.live/crew/events/{event} ran 5px past the edge.
 */
const PAGES = ["/manual", ...HOW_IT_WORKS_AUDIENCES.map((audience) => `/how-it-works/${audience}`)];

/** /manual is behind the operator gate; the owner password opens it. The how-it-works pages are public. */
async function open(page: Page, path: string) {
  if (path !== "/manual") return gotoAndAssert(page, path);
  await gotoAndAssert(page, `/production-access/owner?next=${encodeURIComponent(path)}`);
  await page.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await page.getByRole("button", { name: /enter owner workspace/i }).click();
  await page.waitForURL(/\/manual$/);
}

test.describe("the manual pages fit a 320px phone", () => {
  for (const path of PAGES) {
    test(`${path} has no sideways scroll at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await open(page, path);
      const measured = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        paragraphs: document.querySelectorAll("[data-markdown-document] p").length,
      }));
      expect(measured.paragraphs, `${path} rendered no document`).toBeGreaterThan(0);
      expect(measured.page, `${path} is wider than the phone`).toBeLessThanOrEqual(320);
    });
  }
});
