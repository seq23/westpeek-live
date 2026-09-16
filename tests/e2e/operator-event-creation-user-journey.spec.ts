import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";

const forbidden = /Supabase Auth required|admin account required|login\?next=|not authorized|forbidden|missing setup|unknown event|Application error|Internal Server Error/i;

test("operator can create a real planned event from the launchpad and land on its setup spine", async ({ page }) => {
  await gotoAndAssert(page, "/production-access/operator");

  await page.getByLabel(/operator launchpad password/i).fill(process.env.E2E_OPERATOR_PASSWORD || requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
  await page.getByRole("button", { name: /enter operator launchpad/i }).click();

  await expect(page).toHaveURL(/\/production-access\/launchpad/);
  await expect(page.locator("body")).toContainText(/Operator Launchpad/i);
  await expect(page.getByRole("link", { name: /Create Event in Admin Workspace/i }).first()).toBeVisible();

  await page.getByRole("link", { name: /Create Event in Admin Workspace/i }).first().click();

  await expect(page).toHaveURL(/\/app\/events\/new/);
  await expect(page.getByRole("heading", { name: /Start a Room now, or plan an event for later/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(/Basics.*Branding.*Attendee Flow.*Venue.*Agenda.*Access.*Communications.*Preview.*Publish/i);
  await expect(page.locator("body")).toContainText(/StreamYard/i);
  await expect(page.locator("body")).toContainText(/LiveKit.*Cloudflare Stream, then Daily, then Zoom \+ Google Meet/i);

  const name = `Playwright Operator Preview Event ${Date.now()}`;
  await page.getByTestId("when-later").check();
  await page.getByLabel(/^Event name/i).fill(name);
  await page.getByLabel(/New client name/i).fill("West Peek Productions");
  await page.getByLabel(/^Type/i).selectOption("virtual_summit");
  await page.getByTestId("create-event-submit").click();

  await expect(page).toHaveURL(/\/app\/events\/playwright-operator-preview-event-\d+\?created=1/);
  const eventId = new URL(page.url()).pathname.split("/")[3];
  const body = page.locator("body");
  await expect(page.getByTestId("runtime-event-header")).toBeVisible();
  await expect(body).toContainText(name);
  await expect(body).toContainText("West Peek Productions");
  await expect(page.getByTestId("event-join-code")).toContainText(/^wpl-/);

  await gotoAndAssert(page, `/app/events/${eventId}/setup`);
  await expect(body).toContainText(/Setup.*Basics|Event basics/i);
  await expect(page.getByTestId("event-setup-draft-summary")).toBeVisible();
  await expect(body).toContainText(name);
  await expect(body).toContainText(eventId);
  await expect(page.getByRole("link", { name: /Venue Lobby/i })).toBeVisible();
  await expect(page.getByTestId("event-scoped-day1-command-links").getByRole("link", { name: /^Run of Show$/i })).toBeVisible();
  await expect(body).not.toContainText(forbidden);
});
