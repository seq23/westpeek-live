import { expect, test } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { HOW_IT_WORKS_AUDIENCES } from "@/types/howItWorks";

/**
 * The manual and every how-it-works page fit a 320px phone: nothing in the rendered document
 * (a long link, a path in bold) pushes the page sideways. Seen on /how-it-works/crew, 22 Nov 2026,
 * where westpeek.live/crew/events/{event} ran 5px past the edge.
 */
const PAGES = ["/manual", ...HOW_IT_WORKS_AUDIENCES.map((audience) => `/how-it-works/${audience}`)];

test.describe("the manual pages fit a 320px phone", () => {
  for (const path of PAGES) {
    test(`${path} has no sideways scroll at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await gotoAndAssert(page, path);
      const measured = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        paragraphs: document.querySelectorAll("[data-markdown-document] p").length,
      }));
      expect(measured.paragraphs, `${path} rendered no document`).toBeGreaterThan(0);
      expect(measured.page, `${path} is wider than the phone`).toBeLessThanOrEqual(320);
    });
  }
});
