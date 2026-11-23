import { expect, test } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";

test("people directory exposes rich attendee profiles", async ({ page }) => {
  await gotoAndAssert(page, "/venue/event-summit/people");
  await expect(page.getByText("People").first()).toBeVisible();
  const firstProfile = page.locator("details").first();
  await firstProfile.click();
  await expect(page.getByText("What brings me here").first()).toBeVisible();
  await expect(page.getByText("Interesting fact").first()).toBeVisible();
});
