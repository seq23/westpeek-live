import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";

test("production access surfaces load with explicit access forms", async ({ page }) => {
  await gotoAndAssert(page, "/production-access");
  await expect(page.getByText(/production access/i).first()).toBeVisible();

  await gotoAndAssert(page, "/production-access/crew");
  await expect(page.locator("body")).toContainText(/crew/i);

  await gotoAndAssert(page, "/production-access/special-guest");
  await expect(page.locator("body")).toContainText(/guest|speaker|sponsor|vip/i);
});

test("production access offers the Owner Access card and the owner gate lands on the Owner Console without a second prompt", async ({ page }) => {
  await gotoAndAssert(page, "/production-access");
  await expect(page.getByTestId("owner-access-card")).toContainText(/Owner Access/);
  await expect(page.getByTestId("owner-access-card")).toContainText(/master password opens everything/i);
  await page.getByTestId("owner-access-card").click();
  await expect(page).toHaveURL(/\/production-access\/owner/);

  await page.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await page.getByRole("button", { name: /enter owner workspace/i }).click();
  // The owner master password lands on the Owner Console (16 Sep 2026); the actor chip links there.
  await expect(page).toHaveURL(/\/app\/owner$/);
  await expect(page.getByTestId("workspace-actor")).toContainText(/Sequoia Taylor \/ owner/);
  await expect(page.getByTestId("owner-console")).toBeVisible();

  // The launchpad's Create Event link used to bounce a valid owner back through the operator gate.
  await gotoAndAssert(page, "/production-access/operator?next=/app/events/new");
  await expect(page).toHaveURL(/\/app\/events\/new$/);
  await expect(page.getByRole("heading", { name: /Start a Room now/i })).toBeVisible();
  await gotoAndAssert(page, "/production-access/launchpad");
  await page.getByRole("link", { name: /Create Event in Admin Workspace/i }).first().click();
  await expect(page).toHaveURL(/\/app\/events\/new$/);
  await gotoAndAssert(page, "/production-access/owner?next=/app/settings");
  await expect(page).toHaveURL(/\/app\/settings$/);
});
