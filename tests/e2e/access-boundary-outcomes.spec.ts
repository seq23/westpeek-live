import { test, expect } from "@playwright/test";

test("attendee registration does not grant speaker, sponsor, crew, operator, admin, publish, or restricted access", async ({ page }) => {
  await page.goto("/events/demo/register");
  await expect(page.locator("body")).toContainText(/does not grant speaker, sponsor, client, crew, operator, admin/i);
  await expect(page.locator("body")).toContainText(/does not grant.*camera\/mic publishing access/i);
  // The agenda planner left this page (lighter registration, 16 Sep 2026); the one boundary line
  // now names VIP and restricted sessions itself, and nothing on the page offers to plan them.
  await expect(page.locator("body")).toContainText(/does not grant speaker, sponsor, client, crew, operator, admin, VIP, restricted-session, or camera\/mic publishing access/);
  await expect(page.getByTestId("registration-agenda-planner")).toHaveCount(0);

  await page.goto("/production-access/launchpad");
  await expect(page.locator("body")).toContainText(/Operator|password|access/i);
  await page.goto("/production-access/crew");
  await expect(page.locator("body")).not.toContainText(/Operator Launchpad.*unlocked/i);
});
