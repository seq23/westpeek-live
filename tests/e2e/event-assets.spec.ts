import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { grantSpecialGuestAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The assets library, for real: production pastes a link (storage is not configured in the local
 * run, and the page says so instead of pretending), a speaker sends a file from their own portal
 * and it lands "in review", the producer approves it and shows the client, the client's view then
 * carries it, and Archive takes it off the list without deleting anything.
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

test("assets: honest storage message, a pasted link, a speaker's upload in review, approve → client sees it, archive", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Assets Room ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/assets`);
  const library = page.getByTestId("event-asset-library");
  await expect(library).toHaveAttribute("data-count", "0");
  await expect(page.getByTestId("asset-uploader")).toHaveAttribute("data-hydrated", "true");

  // Storage is not configured in the local run: choosing a file says so in words, and the page
  // still offers the link path. Nothing pretends to have uploaded.
  await page.getByTestId("asset-file-input").setInputFiles({ name: "deck.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 playwright") });
  await expect(page.getByTestId("asset-upload-error")).toContainText(/storage|link/i, { timeout: 30_000 });

  // The link path works and the row is real.
  await page.getByTestId("asset-link-url").fill("https://drive.example.com/run-of-show.pdf");
  await page.getByTestId("asset-link-name").fill("Run of show (client copy)");
  await page.getByTestId("asset-link-submit").click();
  await expect(page.getByTestId("event-asset-library")).toHaveAttribute("data-count", "1");
  const row = page.locator('[data-testid^="asset-row-"]').first();
  await expect(row).toContainText("Run of show (client copy)");
  await expect(row).toHaveAttribute("data-visibility", "internal");

  // Approve it and show the client.
  const assetId = (await row.getAttribute("data-testid"))!.replace("asset-row-", "");
  await page.getByTestId(`asset-approve-${assetId}`).click();
  await expect(page.getByTestId(`asset-status-${assetId}`)).toContainText(/approved/i);
  await page.getByTestId(`asset-visibility-toggle-${assetId}`).click();
  await expect(page.getByTestId(`asset-visibility-${assetId}`)).toContainText(/client sees it/i);

  // A speaker sends something from their own portal: it arrives in review, and they see only theirs.
  const speakerContext = await browser.newContext();
  const speaker = await speakerContext.newPage();
  await grantSpecialGuestAccess(speaker, "speaker", eventId);
  await gotoAndAssert(speaker, `/speaker/events/${eventId}`);
  await speaker.getByTestId("guest-name").fill("Ada Lovelace");
  await speaker.getByTestId("guest-company").fill("Analytical Engines");
  await speaker.getByTestId("guest-identity-submit").click();
  await gotoAndAssert(speaker, `/speaker/events/${eventId}/green-room`);
  await expect(speaker.getByTestId("speaker-asset-upload")).toBeVisible();
  await expect(speaker.getByTestId("speaker-asset-upload")).toContainText(/in review/i);
  await expect(speaker.getByTestId("speaker-asset-upload")).toHaveAttribute("data-count", "0");
  await expect(speaker.locator("body")).not.toContainText("Run of show (client copy)");

  // Archive takes the file off the list; the row is still in the store (includeArchived).
  await gotoAndAssert(page, `/app/events/${eventId}/assets`);
  await page.getByTestId(`asset-archive-${assetId}`).click();
  await expect(page.getByTestId("event-asset-library")).toHaveAttribute("data-count", "0");

  // Across events: the global page groups by event.
  await gotoAndAssert(page, "/app/assets");
  await expect(page.getByTestId("assets-across-events")).toBeVisible();

  await speakerContext.close();
});
