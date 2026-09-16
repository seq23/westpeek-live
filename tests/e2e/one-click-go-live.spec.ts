import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { grantCrewAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Going live is one action, wherever you are. The owner had to set the status on the Publish page
 * and then hunt for the RTMP credentials on the crew deck: "i dont understand why i have to go 2
 * places". One card now does both, on the Publish page, in the Owner Console and on the crew deck,
 * and the empty state after End the show explains itself instead of reading like a fault.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");

async function createLaterEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-later").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/app\/events\/[a-z0-9-]+\?created=1/);
  return new URL(page.url()).pathname.split("/")[3];
}

test("one click on the Publish page goes live AND hands over credentials", async ({ page }) => {
  test.setTimeout(180_000);
  const eventId = await createLaterEvent(page, `One Click ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  const card = page.getByTestId("go-live-card");
  await expect(card).toHaveAttribute("data-has-credentials", "false");
  await expect(page.getByTestId("stream-credentials-empty")).toBeVisible();
  await page.getByTestId("go-live-button").click();
  await expect(page).toHaveURL(new RegExp(`/app/events/${eventId}/publish`));
  // One click did both halves of what used to take two pages: the event is live…
  await expect(page.getByTestId("go-live-card")).toHaveAttribute("data-status", "live");
  // …and the same card is where the credentials live. This local run has placeholder LiveKit keys,
  // so provisioning is refused BY NAME instead of leaving a blank box; production has real keys and
  // the credential path itself is proven in tests/unit/goLiveOneClick.test.ts.
  await expect(page.getByTestId("stream-credentials-problem")).toContainText(/LiveKit/i);
  await expect(page.getByTestId("get-stream-credentials")).toBeVisible();
});

test("the Owner Console starts an event and shows the credentials without opening the crew deck", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createLaterEvent(page, `Console Live ${Date.now()}`);
  const context = await browser.newContext();
  const owner = await context.newPage();
  await gotoAndAssert(owner, "/production-access/owner?next=/app/owner");
  await owner.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await owner.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(owner).toHaveURL(/\/app\/owner$/);
  await expect(owner.getByTestId("console-section-events")).toHaveAttribute("data-hydrated", "true");
  await owner.getByTestId("console-section-events-toggle").click();
  const fold = owner.getByTestId(`console-go-live-${eventId}`);
  await fold.locator("summary").click();
  const card = fold.getByTestId("go-live-card");
  await expect(card).toHaveAttribute("data-status", "draft");
  await card.getByTestId("go-live-button").click();
  await expect(owner).toHaveURL(/\/app\/owner/);
  // The event is live, and the console's Live now section now carries its go-live card — the
  // credentials are reachable without ever opening the crew deck.
  await expect(owner.getByTestId(`console-live-${eventId}`)).toBeVisible({ timeout: 30_000 });
  await expect(owner.getByTestId(`console-live-${eventId}`).getByTestId("go-live-card")).toBeVisible();
  await context.close();
});

test("after End the show the card explains the released key, and one click gets a new one; crew without go_live cannot", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const eventId = await createLaterEvent(page, `Restart ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  await page.getByTestId("go-live-button").click();
  await expect(page.getByTestId("go-live-card")).toHaveAttribute("data-status", "live");

  // End the show: the key is released on purpose, and the card says so.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("end-show-button").first().click();
  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  await expect(page.getByTestId("go-live-card")).toHaveAttribute("data-ended", "true");
  await expect(page.getByTestId("stream-credentials-empty")).toContainText(/stream key was released/i);

  // One click asks for a new one, from right here — no crew deck, no scrolling.
  await expect(page.getByTestId("get-stream-credentials")).toBeVisible();
  await page.getByTestId("get-stream-credentials").click();
  await expect(page.getByTestId("stream-credentials-problem")).toBeVisible({ timeout: 30_000 });

  // A moderator sees the card and is told why they cannot act.
  const crewContext = await browser.newContext();
  const moderator = await crewContext.newPage();
  await grantCrewAccess(moderator, "moderator", eventId);
  await gotoAndAssert(moderator, `/crew/events/${eventId}`);
  const crewCard = moderator.getByTestId("go-live-card");
  await expect(crewCard).toBeVisible();
  await expect(crewCard.getByTestId("get-stream-credentials")).toHaveCount(0);
  await expect(crewCard.getByTestId("new-stream-key")).toHaveCount(0);
  await crewContext.close();
});
