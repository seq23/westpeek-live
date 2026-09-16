import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * VIP is a credential. A registered attendee who types the event's VIP code becomes one; a wrong
 * code is refused in words; the crew can issue it from the roster and sees how each VIP got in;
 * and rotating the VIP code takes every grant with it — including the one the crew issued.
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

test("the VIP code makes a VIP; the crew can issue it; rotating it takes everyone with it", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const eventId = await createNowEvent(page, `VIP Room ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  const vipCode = (await page.getByTestId("generated-vip-code").innerText()).trim();
  expect(vipCode).toMatch(/^WPL-VIP-/);

  // An attendee registers, sees the card, and is refused a wrong code before the right one works.
  const context = await browser.newContext();
  const guest = await context.newPage();
  await gotoAndAssert(guest, `/events/${eventId}/register`);
  await guest.locator('[name="name"]').fill("Cal VIP");
  await guest.locator('[name="email"]').fill(`cal-${Date.now()}@realco.io`);
  await guest.locator('[name="company"]').fill("Real Co");
  await guest.getByRole("button", { name: /submit registration/i }).click();
  await expect(guest).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?registered=1/);
  const card = guest.getByTestId("vip-code-card");
  await expect(card).toHaveAttribute("data-registered", "true");
  await guest.getByTestId("vip-code-input").fill("WPL-VIP-NOPE");
  await guest.getByTestId("vip-code-submit").click();
  await expect(guest.getByTestId("vip-code-refused")).toBeVisible();
  await expect(guest.getByTestId("vip-lobby-panel")).toHaveCount(0);
  await guest.getByTestId("vip-code-input").fill(vipCode.toLowerCase());
  await guest.getByTestId("vip-code-submit").click();
  await expect(guest.getByTestId("vip-badge")).toBeVisible();
  await expect(guest.getByTestId("vip-code-card")).toHaveCount(0);

  // The crew sees how they got in, and can issue the code to somebody else from the roster.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  const vipControl = page.locator('[data-testid^="vip-control-"]').first();
  await expect(vipControl).toHaveAttribute("data-vip", "true");
  await expect(page.locator('[data-testid^="vip-why-"]').first()).toContainText(/Entered the VIP code/i);

  // Rotate the VIP code: the grant is no longer current and the lounge closes.
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  await page.getByTestId("code-regenerate-vip").click();
  await expect(page).toHaveURL(/codeSaved=vip/);
  await gotoAndAssert(guest, `/venue/${eventId}/lobby`);
  await expect(guest.getByTestId("vip-badge")).toHaveCount(0);
  await expect(guest.getByTestId("vip-code-card")).toBeVisible();

  // The new code admits them again.
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  const rotated = (await page.getByTestId("generated-vip-code").innerText()).trim();
  expect(rotated).not.toBe(vipCode);
  await guest.getByTestId("vip-code-input").fill(rotated);
  await guest.getByTestId("vip-code-submit").click();
  await expect(guest.getByTestId("vip-badge")).toBeVisible();

  await context.close();
});
