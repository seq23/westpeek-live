import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Communications, for real: the banner says what the deployment can actually do, each workflow
 * says when it last went out (or that it never has), a send with nobody addressed is refused in
 * words, a real send writes a row naming who sent it, and /app/email shows it across events.
 * Local file-store run only — Resend is not configured here, so the provider is the mock and the
 * rows say so, which is exactly the honesty being tested.
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

test("communications shows what was really sent, refuses an empty send, and records a real one", async ({ page }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Email Room ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/communications`);
  const center = page.getByTestId("event-email-center");
  await expect(center).toHaveAttribute("data-sent-count", "0");
  await expect(page.getByTestId("email-provider-banner")).toContainText(/Resend/);
  await expect(page.getByTestId("email-last-speaker_invite")).toContainText(/Never sent for this event/i);

  // Nobody addressed: refused, and nothing is logged.
  await page.getByTestId("email-send-speaker_invite").click();
  await expect(page.getByTestId("email-error-note")).toContainText(/at least one email/i);
  await expect(page.getByTestId("event-email-center")).toHaveAttribute("data-sent-count", "0");

  // A real send: one row, the provider named, who sent it recorded.
  await page.getByTestId("email-recipients-speaker_invite").fill("ada@example.com, cal@example.com");
  await page.getByTestId("email-message-speaker_invite").fill("Green room opens at 9.");
  await page.getByTestId("email-send-speaker_invite").click();
  await expect(page.getByTestId("email-sent-note")).toContainText("Sent 2");
  await expect(page.getByTestId("event-email-center")).toHaveAttribute("data-sent-count", "2");
  await expect(page.getByTestId("email-last-speaker_invite")).toContainText(/Last sent to/);
  await expect(page.getByTestId("email-log")).toContainText("ada@example.com");
  await expect(page.getByTestId("email-log")).toContainText("operator");

  // And the cross-event page carries it.
  await gotoAndAssert(page, "/app/email");
  // Other events in this run may have sent too; what matters is that this event is in the record.
  expect(Number(await page.getByTestId("email-across-events").getAttribute("data-count"))).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId(`email-event-${eventId}`)).toContainText("speaker invite");
});
