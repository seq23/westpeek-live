import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * /app/people is the owner's real network: our own Playwright / Tier-4 fixtures (test domains,
 * seed and automation events) are counted apart, hidden behind a remembered "Show test rows"
 * toggle, left out of the CSV, and archived — never deleted — when she asks.
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

async function register(page: Page, eventId: string, name: string, email: string) {
  await gotoAndAssert(page, `/events/${eventId}/register`);
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="company"]').fill("Proof Co");
  await page.getByRole("button", { name: /submit registration/i }).click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/(lobby|stage)/);
}

test("the People page shows real people by default; test rows are counted apart, revealed on request, and archived without touching the real ones", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const eventId = await createNowEvent(page, `Real Room ${stamp}`);
  const realEmail = `cal-${stamp}@realcompany.io`;
  const testEmail = `outcome-${stamp}@example.invalid`;
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await register(guest, eventId, "Cal Real", realEmail);
  const fixtureContext = await browser.newContext();
  const fixture = await fixtureContext.newPage();
  await register(fixture, eventId, "Tier 4 Browser Event Goer", testEmail);

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await gotoAndAssert(owner, "/production-access/owner?next=/app/people");
  await owner.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await owner.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(owner).toHaveURL(/\/app\/people$/);

  // Default: the real person is on the page, the fixture is not — not even its address.
  await expect(owner.getByTestId(`contact-row-${realEmail}`)).toBeVisible();
  await expect(owner.locator("body")).not.toContainText("example.invalid");
  const card = owner.getByTestId("contacts-across-events");
  const realCount = Number(await card.getAttribute("data-count"));
  const testCount = Number(await card.getAttribute("data-test-count"));
  expect(testCount).toBeGreaterThanOrEqual(1);
  const csv = await (await owner.request.get("/api/contacts/export")).text();
  expect(csv).toContain(realEmail);
  expect(csv).not.toContain(testEmail);
  expect(csv.trim().split("\n")).toHaveLength(realCount + 1);
  expect((await (await owner.request.get("/api/contacts/export?includeTest=1")).text())).toContain(testEmail);

  // Show test rows: remembered across a reload.
  const toggle = owner.getByTestId("people-test-rows");
  await expect(toggle).toHaveAttribute("data-hydrated", "true");
  await expect(owner.getByTestId("people-test-rows-toggle")).toContainText(`Show test rows (${testCount})`);
  await owner.getByTestId("people-test-rows-toggle").click();
  await expect(owner.getByTestId(`test-contact-row-${testEmail}`)).toBeVisible();
  await owner.reload();
  await expect(owner.getByTestId("people-test-rows")).toHaveAttribute("data-open", "true");
  await owner.getByTestId("people-test-rows-toggle").click();

  // Archive them: the real person stays, the count stays, the fixtures are gone from the page.
  owner.once("dialog", (dialog) => { expect(dialog.message()).toContain("archived, never deleted"); void dialog.accept(); });
  await owner.getByTestId("archive-test-rows").click();
  // The button goes away with the rows it archived (the page revalidates in place).
  await expect(owner.getByTestId("archive-test-rows")).toHaveCount(0, { timeout: 20_000 });
  await owner.reload();
  await expect(owner.getByTestId(`contact-row-${realEmail}`)).toBeVisible();
  await expect(owner.getByTestId("contacts-across-events")).toHaveAttribute("data-count", String(realCount));
  await expect(owner.getByTestId("contacts-across-events")).toHaveAttribute("data-test-count", "0");
  await expect(owner.locator("body")).not.toContainText("example.invalid");

  await guestContext.close();
  await fixtureContext.close();
  await ownerContext.close();
});
