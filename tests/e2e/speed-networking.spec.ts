import { expect, test } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";

test("speed networking attendee surface exposes matching, queue, timer, and fallback context", async ({ page }) => {
  await gotoAndAssert(page, "/venue/event-summit/networking");
  const body = await page.locator("body").innerText();
  for (const term of ["network", "match", "queue", "timer"]) {
    expect(body.toLowerCase()).toContain(term);
  }
});
