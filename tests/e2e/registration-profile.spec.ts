import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";

/** Registration asks for three things (plus an optional title); the rich profile fields live on "Tell us more" inside the venue. */
test("registration is name, email, company (+ optional title); the rich fields are not on the form", async ({ page }) => {
  await gotoAndAssert(page, "/events/nova-summit/register");
  for (const field of ["name", "email", "company", "title"]) await expect(page.locator(`[name="${field}"]`)).toBeVisible();
  await expect(page.locator('[name="title"]')).not.toHaveAttribute("required", "");
  for (const field of ["personalWebsite", "socialLinks", "reasonForAttending", "interestingFact", "topicsOfInterest", "networkingGoals"]) await expect(page.locator(`[name="${field}"]`)).toHaveCount(0);
});
