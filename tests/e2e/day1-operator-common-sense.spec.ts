import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { day1Passwords, requiredDay1Default } from "./helpers/day1AccessDefaults";

test("operator Day 1 password unlocks create-event flow without a second auth wall", async ({ page }) => {
  await gotoAndAssert(page, "/production-access/operator");

  await page.getByLabel(/operator launchpad password/i).fill(process.env.E2E_OPERATOR_PASSWORD || requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
  await page.getByRole("button", { name: /enter operator launchpad/i }).click();

  await expect(page).toHaveURL(/\/production-access\/launchpad/);
  await expect(page.getByRole("heading", { name: /everything internal starts here/i })).toBeVisible();

  await page.getByRole("link", { name: /create event in admin workspace/i }).first().click();

  await expect(page).toHaveURL(/\/app\/events\/new/);
  await expect(page.getByRole("heading", { name: /start a room now, or plan an event for later/i })).toBeVisible();
  await expect(page.getByTestId("create-event-submit")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/supabase auth|required admin account|login\?next|operator gate/i);
});

test("public production access gates do not reveal Day 1 passwords", async ({ page }) => {
  for (const route of ["/production-access/operator", "/production-access/crew", "/production-access/special-guest"]) {
    await gotoAndAssert(page, route);
    const body = await page.locator("body").innerText();
    for (const password of day1Passwords) {
      expect(body, `${route} must not expose ${password}`).not.toContain(password);
    }
  }
});
