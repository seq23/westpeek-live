import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { grantCrewAccess, grantSpecialGuestAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * "View as" a special guest, and the owner's Preview-a-guest landing:
 *   a speaker gives their name → the crew deck's speaker row and the Access page show
 *   "Open their green room / teleprompter" → the owner opens the green room as the speaker and
 *   sees the banner, the speaker's real state, and the speaker's actions disabled (Go on stage,
 *   tech check, paste); the nav keeps ?viewAs; the teleprompter polls THAT speaker's deck;
 *   a moderator crew cookie and the speaker themself get no banner from ?viewAs;
 *   the special-guest gate + owner master password lands on Preview a guest for the typed code,
 *   which lists the speaker with the same links; an event with no guests says so.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

async function speakerNamed(browser: Browser, eventId: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await grantSpecialGuestAccess(page, "speaker", eventId);
  await gotoAndAssert(page, `/speaker/events/${eventId}`);
  await page.getByTestId("guest-name").fill(name);
  await page.getByTestId("guest-company").fill("Analytical Engines");
  await page.getByTestId("guest-identity-submit").click();
  await expect(page.getByTestId("speaker-portal-shell")).toContainText(name);
  return { context, page };
}

async function ownerPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await gotoAndAssert(page, "/production-access/owner");
  await page.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await page.getByRole("button", { name: /enter owner workspace/i }).click();
  // The owner gate lands on the Owner Console since #36.
  await expect(page).toHaveURL(/\/app\/owner$/);
  return { context, page };
}

test("owner opens a speaker's green room via view-as: banner, real state, actions disabled; others get no banner", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `View As ${Date.now()}`);
  const speaker = await speakerNamed(browser, eventId, "Sam Speaker");

  // The operator (the test's own page) sees the links on the crew deck's speaker row and on the Access page.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  const row = page.getByTestId(/^speaker-row-/).first();
  await expect(row).toContainText("Sam Speaker");
  const guestId = (await row.getAttribute("data-testid"))!.replace("speaker-row-", "");
  await expect(row.getByTestId(`open-green-room-${guestId}`)).toHaveAttribute("href", `/speaker/events/${eventId}/green-room?viewAs=${guestId}`);
  await expect(row.getByTestId(`open-teleprompter-${guestId}`)).toBeVisible();
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  await expect(page.getByTestId("access-guest-preview").getByTestId(`guest-preview-row-${guestId}`)).toContainText("Sam Speaker");

  // The owner opens the green room as Sam.
  const owner = await ownerPage(browser);
  await gotoAndAssert(owner.page, `/speaker/events/${eventId}/green-room?viewAs=${guestId}`);
  const banner = owner.page.getByTestId("view-as-banner");
  await expect(banner).toContainText("Viewing as Sam Speaker — you are the owner; they can’t see this banner.");
  await expect(banner).toHaveAttribute("data-view-as", guestId);
  await expect(owner.page.getByTestId("speaker-portal-shell")).toContainText("Sam Speaker · Analytical Engines");
  await expect(owner.page.getByTestId("speaker-green-room")).toHaveAttribute("data-stage-status", "backstage");
  await expect(owner.page.getByTestId("guest-room-video-preview-placeholder")).toBeVisible();
  await expect(owner.page.getByTestId("guest-room-video-green_room")).toHaveCount(0);
  await expect(owner.page.getByTestId("run-tech-check-disabled")).toBeVisible();
  // Nav keeps the parameter; the teleprompter page disables the paste form and polls Sam's deck.
  await owner.page.getByRole("link", { name: "Cue cards" }).click();
  await expect(owner.page).toHaveURL(new RegExp(`/speaker/events/${eventId}/teleprompter\\?viewAs=${guestId}`));
  await expect(owner.page.getByTestId("view-as-banner")).toBeVisible();
  await expect(owner.page.getByTestId("speaker-material-submission-form")).toHaveAttribute("data-read-only", "true");
  await expect(owner.page.getByTestId("speaker-cue-submit")).toBeDisabled();
  await expect(owner.page.getByTestId("speaker-teleprompter")).toBeVisible();
  // Tech check page: theirs to run.
  await owner.page.getByRole("link", { name: "Tech check" }).click();
  await expect(owner.page.getByTestId("tech-check-preview-disabled")).toContainText("Tech check is theirs to run");
  // The producer writes cue cards from the deck; the owner's preview shows them as Sam would see them.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  await page.getByTestId(`speaker-cue-editor-${guestId}`).locator("summary").click();
  await page.getByTestId(`cue-cards-input-${guestId}`).fill("Open | Thank the host\nClose | Invite Q&A");
  await page.getByTestId(`save-cue-deck-${guestId}`).click();
  await gotoAndAssert(owner.page, `/speaker/events/${eventId}/teleprompter?viewAs=${guestId}`);
  await expect(owner.page.getByTestId("teleprompter-card-title")).toHaveText("Open");
  // Once the crew brings Sam up, the owner's preview shows the call with Go on stage disabled.
  await page.getByTestId(`bring-to-stage-${guestId}`).click();
  await gotoAndAssert(owner.page, `/speaker/events/${eventId}/green-room?viewAs=${guestId}`);
  await expect(owner.page.getByTestId("speaker-green-room")).toHaveAttribute("data-stage-status", "invited");
  await expect(owner.page.getByTestId("go-on-stage")).toBeDisabled();

  // A moderator's crew cookie is not a viewer: the page renders as the moderator (no identity, no banner) — the middleware refuses the path.
  const moderatorContext = await browser.newContext();
  const moderator = await moderatorContext.newPage();
  await grantCrewAccess(moderator, "moderator", eventId);
  await moderator.goto(`/speaker/events/${eventId}/green-room?viewAs=${guestId}`);
  await expect(moderator).toHaveURL(/\/production-access\/special-guest/);
  await moderatorContext.close();
  // A producer's crew cookie IS a viewer.
  const producerContext = await browser.newContext();
  const producer = await producerContext.newPage();
  await grantCrewAccess(producer, "producer", eventId);
  await gotoAndAssert(producer, `/speaker/events/${eventId}/green-room?viewAs=${guestId}`);
  await expect(producer.getByTestId("view-as-banner")).toContainText("you are the producer");
  await producerContext.close();
  // The speaker themself with ?viewAs= sees their own page, no banner.
  await gotoAndAssert(speaker.page, `/speaker/events/${eventId}/green-room?viewAs=${guestId}`);
  await expect(speaker.page.getByTestId("view-as-banner")).toHaveCount(0);
  await expect(speaker.page.getByTestId("go-on-stage")).toBeEnabled();

  // The special-guest gate + owner master password lands on Preview a guest for the typed event.
  await gotoAndAssert(owner.page, "/production-access/special-guest");
  await owner.page.getByLabel(/event code/i).fill(eventId);
  await owner.page.getByLabel(/special guest password/i).fill(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_MASTER_ACCESS_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await owner.page.getByRole("button", { name: /continue to assigned portal/i }).click();
  await expect(owner.page).toHaveURL(new RegExp(`/production-access/special-guest/preview\\?event=${eventId}`));
  const preview = owner.page.getByTestId("preview-guest-page");
  await expect(preview).toHaveAttribute("data-event-id", eventId);
  await expect(preview.getByTestId(`guest-preview-row-${guestId}`)).toContainText("Sam Speaker");
  await expect(preview.getByTestId("preview-code-speaker")).not.toBeEmpty();
  await preview.getByTestId(`open-teleprompter-${guestId}`).click();
  await expect(owner.page.getByTestId("view-as-banner")).toBeVisible();

  await speaker.context.close();
  await owner.context.close();
});

test("preview page with no guests says so and links to the Access page; not the owner → owner gate", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const eventId = await createNowEvent(page, `Empty Preview ${Date.now()}`);
  await page.goto(`/production-access/special-guest/preview?event=${eventId}`);
  await expect(page).toHaveURL(/\/production-access\/owner\?next=/);
  const owner = await ownerPage(browser);
  await gotoAndAssert(owner.page, `/production-access/special-guest/preview?event=${eventId}`);
  await expect(owner.page.getByTestId("guest-preview-empty")).toContainText("No special guests yet");
  await expect(owner.page.getByTestId("guest-preview-access-link")).toHaveAttribute("href", `/app/events/${eventId}/access`);
  await gotoAndAssert(owner.page, "/production-access/special-guest/preview?event=no-such-event-xyz");
  await expect(owner.page.getByTestId("preview-event-unknown")).toBeVisible();
  await owner.context.close();
});
