import { test, expect } from "@playwright/test";

test("attendee registration is three fields, creates a session, and the venue carries agenda planning and tell-us-more", async ({ page, context }) => {
  await page.goto("/events/demo/register");
  await expect(page.locator("body")).toContainText(/company \/ affiliation/i);
  // Lighter registration (16 Sep 2026): no planner, no long form here; those live inside the venue.
  await expect(page.getByTestId("registration-agenda-planner")).toHaveCount(0);
  await expect(page.locator("form [required]")).toHaveCount(3);
  await page.getByLabel(/^name/i).fill("Outcome Attendee");
  await page.getByLabel(/email/i).fill(`outcome-${Date.now()}@example.com`);
  await page.getByLabel(/company/i).fill("Outcome Co");
  await page.getByRole("button", { name: /submit registration|enter venue|register|join/i }).click();
  await expect(page).toHaveURL(/\/venue\/.*\/lobby|\/venue\/.*\/stage/);
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name.includes("attendee_session"))).toBeTruthy();
  await page.goto(page.url().replace(/\/lobby.*/, "/stage"));
  await expect(page.getByTestId("my-agenda-panel")).toBeVisible();
  await expect(page.getByTestId("attendee-profile-panel")).toBeVisible();
});
