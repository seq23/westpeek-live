import { expect, test } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";

test("protected role surfaces degrade without generic application errors", async ({ page }) => {
  for (const route of [
    "/app/events/event-summit/venue",
    "/venue/event-summit/stage",
    "/venue/event-summit/run-of-show",
    "/venue/event-summit/help",
  ]) {
    await gotoAndAssert(page, route);
    await expect(page.locator("body")).not.toBeEmpty();
  }
});
