import { expect, test, type Page } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";

const forbidden = /Application error|Internal Server Error|operator required|admin account required|missing setup|unknown event/i;

async function loginCrew(page: Page) {
  await gotoAndAssert(page, "/production-access/crew");
  await page.getByLabel(/crew password/i).fill(process.env.E2E_CREW_PASSWORD || requiredDay1Default("CREW_ACCESS_PASSWORD"));
  await page.getByLabel(/event code/i).fill("demo");
  await page.getByLabel(/production role/i).selectOption("crew");
  await page.getByRole("button", { name: /enter crew workspace/i }).click();
}

test("crew login reaches real show-day instructions, not a special guest gate", async ({ page }) => {
  await loginCrew(page);

  await expect(page).not.toHaveURL(/\/production-access\/special-guest/);
  await expect(page).toHaveURL(/\/crew\/events\/(demo|event-summit)/);

  const body = page.locator("body");
  await expect(body).toContainText(/Crew show-day command|Crew Briefing/i);
  await expect(body).toContainText(/Call Sheet/i);
  await expect(body).toContainText(/Run of Show/i);
  await expect(body).toContainText(/Tasks/i);
  await expect(body).toContainText(/Escalation/i);
  await expect(body).toContainText(/fallback|LiveKit|Daily|Zoom|Google Meet/i);
  await expect(body).not.toContainText(forbidden);
});

test("crew show-day links resolve to instruction surfaces and crew cannot use operator powers", async ({ page }) => {
  await loginCrew(page);

  for (const route of [
    "/crew/events/event-summit",
    "/crew/events/event-summit/call-sheet",
    "/crew/events/event-summit/run-of-show",
    "/crew/events/event-summit/tasks",
  ]) {
    await gotoAndAssert(page, route);
    await expect(page).not.toHaveURL(/\/production-access\/special-guest/);
    await expect(page.locator("body")).toContainText(/Crew|Call Sheet|Run of Show|Tasks|Escalation/i);
    await expect(page.locator("body")).not.toContainText(forbidden);
  }

  await gotoAndAssert(page, "/app/events/new");
  await expect(page).not.toHaveURL(/\/app\/events\/new$/);
  await expect(page).toHaveURL(/\/production-access\/operator/);
});
