import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";

/**
 * /request-event after a submission.
 *
 * On 26 Sep 2026 a real prospect submitted the form from a phone and landed on
 * /request-event?status=received: a one-line green banner above the SAME empty form.
 * It read as "nothing happened". The receipt is now a page of its own — no form,
 * no submit button — and the failure statuses keep the form because they need it.
 * requestEventActions still redirects with status=received|missing|failed; that
 * contract is pinned by tests/unit/requestEventIntake.test.ts.
 */

test("status=received is a confirmation card, not the form again", async ({ page }) => {
  await gotoAndAssert(page, "/request-event?status=received");

  const card = page.getByTestId("request-event-received");
  await expect(card).toBeVisible();
  await expect(page.getByRole("heading", { name: /your request is in/i })).toBeVisible();
  await expect(card).toContainText(/comes back with a scope and a price/i);
  await expect(card).toContainText(/an email from West Peek Live/i);

  // No form of any kind, no submit button, no field the visitor just filled in.
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /submit event request/i })).toHaveCount(0);
  await expect(page.getByTestId("request-event-budget")).toHaveCount(0);
  await expect(page.locator("input, textarea, select")).toHaveCount(0);

  // The two ways forward.
  await expect(page.getByRole("link", { name: /submit another request/i })).toHaveAttribute("href", "/request-event");
  await expect(page.getByRole("link", { name: /back to west peek home/i })).toHaveAttribute("href", "/");
});

test("plain /request-event still shows the form", async ({ page }) => {
  await gotoAndAssert(page, "/request-event");

  await expect(page.getByRole("heading", { name: /request event production support/i })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /submit event request/i })).toBeVisible();
  await expect(page.getByTestId("request-event-budget")).toBeVisible();
  await expect(page.getByTestId("request-event-received")).toHaveCount(0);
});

test("status=missing and status=failed keep the form, with their banner", async ({ page }) => {
  await gotoAndAssert(page, "/request-event?status=missing");
  await expect(page.getByText(/a valid email and a budget range are required/i)).toBeVisible();
  await expect(page.locator("form")).toHaveCount(1);
  await expect(page.getByTestId("request-event-received")).toHaveCount(0);

  await gotoAndAssert(page, "/request-event?status=failed");
  await expect(page.getByText(/could not save your request/i)).toBeVisible();
  await expect(page.locator("form")).toHaveCount(1);
  await expect(page.getByTestId("request-event-received")).toHaveCount(0);
});
