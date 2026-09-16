import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Templates that do something: save one from an event that worked, then "Use this template" opens
 * the create form already filled in, and the event it makes has that template's length and agenda.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

test("write a template, use it, and the new event carries its agenda", async ({ page }) => {
  test.setTimeout(180_000);
  await createNowEvent(page, `Template Source ${Date.now()}`);
  await gotoAndAssert(page, "/app/templates");
  await expect(page.getByTestId("event-templates")).toContainText("A template is a starting point for an event");

  // Write one by hand.
  const templateName = `Three part ${Date.now()}`;
  await page.getByTestId("template-name").fill(templateName);
  await page.getByTestId("template-description").fill("Welcome, talk, questions.");
  await page.getByTestId("template-duration").fill("60");
  await page.getByTestId("template-sessions").fill("Welcome | 10\nMain talk | 35\nQ&A | 15");
  await page.getByTestId("save-template-submit").click();
  await expect(page.getByTestId("template-saved")).toContainText(templateName);
  const card = page.locator('[data-testid^="template-template-"]').first();
  await expect(card).toContainText("3 sessions");

  // Use it: the create form opens already filled in.
  const templateId = (await card.getAttribute("data-testid"))!.replace(/^template-/, "");
  await page.getByTestId(`use-template-${templateId}`).click();
  await expect(page).toHaveURL(/\/app\/events\/new\?template=/);
  await expect(page.getByTestId("create-from-template")).toContainText(templateName);
  await page.getByTestId("create-event-name").fill(`From template ${Date.now()}`);
  await page.getByTestId("when-now").check();
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  const eventId = new URL(page.url()).pathname.split("/")[2];

  // The event it made carries the template's agenda.
  await gotoAndAssert(page, `/app/events/${eventId}/agenda`);
  await expect(page.locator("body")).toContainText("Main talk");
  await expect(page.locator("body")).toContainText("Q&A");
});

test("save an existing event as a template", async ({ page }) => {
  test.setTimeout(150_000);
  const eventId = await createNowEvent(page, `Saveable ${Date.now()}`);
  await gotoAndAssert(page, "/app/templates");
  await page.getByTestId("template-event-select").selectOption(eventId);
  await page.getByTestId("template-from-event-name").fill(`Saved from event ${Date.now()}`);
  await page.getByTestId("save-event-as-template-submit").click();
  await expect(page.getByTestId("template-saved")).toContainText("Saved from event");
  await expect(page.getByTestId("event-templates")).toContainText("Saved from");
});
