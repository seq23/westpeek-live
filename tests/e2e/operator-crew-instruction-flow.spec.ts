import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { openConsoleSection } from "./helpers/roleJourney";

test("operator can find crew instructions and crew can consume them without operator launchpad access", async ({ page }) => {
  await gotoAndAssert(page, "/production-access/operator");
  await page.getByLabel(/operator launchpad password/i).fill(process.env.E2E_OPERATOR_PASSWORD || requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
  await page.getByRole("button", { name: /enter operator launchpad/i }).click();

  await expect(page).toHaveURL(/\/production-access\/launchpad/);
  // Crew briefing is a card in the launchpad's "Set up an event" section, for the event in hand;
  // make sure there is one, however empty the store is.
  await gotoAndAssert(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(`Crew Brief ${Date.now()}`);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  await gotoAndAssert(page, "/production-access/launchpad");
  const setUp = await openConsoleSection(page, "set-up");
  await setUp.getByRole("link", { name: /^Crew briefing/ }).click();

  await expect(page).toHaveURL(/\/app\/events\/[a-z0-9-]+\/crew$/);
  const eventId = new URL(page.url()).pathname.split("/")[3];
  await expect(page.locator("body")).toContainText(/Publish crew instructions for show day/i);
  await expect(page.locator("body")).toContainText(/call sheet|run of show|task list|fallback|escalation/i);
  await expect(page.getByRole("link", { name: /Preview Crew Home/i })).toBeVisible();

  await page.getByRole("link", { name: /Preview Crew Home/i }).click();
  await expect(page).toHaveURL(new RegExp(`/crew/events/${eventId}$`));
  await expect(page.locator("body")).toContainText(/Crew show-day command|Crew Briefing/i);
  await expect(page.locator("body")).toContainText(/Do not use the Operator Launchpad/i);
});

test("crew without operator access is refused from operator launchpad but still has instructions", async ({ page }) => {
  await gotoAndAssert(page, "/production-access/crew");
  await page.getByLabel(/crew password/i).fill(process.env.E2E_CREW_PASSWORD || requiredDay1Default("CREW_ACCESS_PASSWORD"));
  await page.getByLabel(/event code/i).fill("demo");
  await page.getByLabel(/production role/i).selectOption("crew");
  await page.getByRole("button", { name: /enter crew workspace/i }).click();

  await expect(page).toHaveURL(/\/crew\/events\/(demo|event-summit)/);
  await expect(page.locator("body")).toContainText(/Crew show-day command|Crew Briefing/i);

  await gotoAndAssert(page, "/production-access/launchpad");
  await expect(page).toHaveURL(/\/production-access\/operator/);
});
