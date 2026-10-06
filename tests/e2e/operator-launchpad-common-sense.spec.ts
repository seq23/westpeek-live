import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { openConsoleSection } from "./helpers/roleJourney";

const forbidden = /Application error|Internal Server Error|not authorized|forbidden|missing setup|unknown event|Supabase Auth required|admin account required/i;

async function loginOperator(page: Page) {
  await gotoAndAssert(page, "/production-access/operator");
  await page.getByLabel(/operator launchpad password/i).fill(process.env.E2E_OPERATOR_PASSWORD || requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
  await page.getByRole("button", { name: /enter operator launchpad/i }).click();
  await expect(page).toHaveURL(/\/production-access\/launchpad/);
}

test("operator launchpad exposes useful Day 1 actions without obvious dead-end language", async ({ page }) => {
  await loginOperator(page);

  // The reorganised launchpad (16 Sep 2026): real events first, then folded sections that each
  // hold the cards for one job. Every Day 1 action is still one click from here. The show-day
  // cards belong to an event, so there is one on the books first.
  await gotoAndAssert(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(`Launchpad Room ${Date.now()}`);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  await gotoAndAssert(page, "/production-access/launchpad");
  const body = page.locator("body");
  await expect(body).toContainText(/Operator Launchpad/i);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Everything internal starts here.");
  await expect(page.getByTestId("operator-launchpad").getByRole("link", { name: "New event", exact: true }).first()).toHaveAttribute("href", "/app/events/new");
  const run = await openConsoleSection(page, "run-a-show");
  for (const card of ["Run of show", "Video health", "Crew console", "Testing console"]) await expect(run.getByRole("link", { name: new RegExp(`^${card}`) })).toBeVisible();
  const demo = await openConsoleSection(page, "demo");
  await expect(demo.getByRole("link", { name: /^Demo venue/ })).toHaveAttribute("href", "/venue/demo/lobby");
  await expect(demo.getByRole("link", { name: /^Operator packet/ })).toHaveAttribute("href", "/operator-packet");
  await expect(demo.getByRole("link", { name: /^Test a crew login/ })).toHaveAttribute("href", "/production-access/crew");
  await expect(body).not.toContainText(forbidden);
});

test("operator preview venue button opens the seeded phony venue without app errors", async ({ page }) => {
  await loginOperator(page);

  const demo = await openConsoleSection(page, "demo");
  await demo.getByRole("link", { name: /^Demo venue/ }).click();
  await expect(page).toHaveURL(/\/venue\/demo\/lobby/);
  await expect(page.locator("body")).toContainText(/Lobby|Attendee venue|West Peek/i);
  await expect(page.locator("body")).not.toContainText(forbidden);

  await page.getByRole("link", { name: /Networking/i }).first().click();
  await expect(page).toHaveURL(/\/venue\/(demo|event-summit)\/networking/);
  await expect(page.locator("body")).toContainText(/Networking/i);
  await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error|unknown event|forbidden|not authorized/i);
});
