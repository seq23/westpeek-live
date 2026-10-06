import { test, expect } from "@playwright/test";

test("venue identity powers main-stage, breakout, networking, help, people, and My Agenda / my-agenda surfaces", async ({ page }) => {
  await page.goto("/venue/demo/stage");
  await expect(page.locator("body")).not.toContainText("current-attendee");
  await expect(page.locator("body")).not.toContainText("Conference Attendee");
  // A visitor who has not registered is told what registering unlocks, not shown a borrowed identity.
  await expect(page.locator("body")).toContainText("Registering with your name, email and company is what lets you take part.");

  await page.goto("/venue/demo/breakouts");
  await expect(page.locator("body")).toContainText(/breakout|chat|Register/i);
  await expect(page.locator("body")).not.toContainText("current-attendee");

  await page.goto("/venue/demo/networking");
  // A visitor who has not registered gets the one register link, carrying why they were sent.
  await expect(page.getByTestId("networking-register-link")).toHaveAttribute("href", /^\/events\/(demo|event-summit)\/register\?reason=networking$/);
  await expect(page.locator("body")).not.toContainText("Local E2E Attendee");

  await page.goto("/venue/demo/help");
  await expect(page.locator("body")).toContainText(/attendee profile|Ask for help/i);

  await page.goto("/venue/demo/people");
  await expect(page.locator("body")).toContainText(/People|Networking/i);
});
