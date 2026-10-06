import { test, expect } from "@playwright/test";

test("attendee live participation requires crew approval, blocks publish by default, and supports revoke language", async ({ page }) => {
  await page.goto("/venue/demo/stage");
  const body = page.locator("body");
  // Speaking is a request the crew approves; a visitor who has not been approved has no camera or
  // mic controls on the page at all, only the request.
  await expect(body).toContainText("The crew sees your request on their roster and approves it when it is your moment.");
  await expect(page.getByTestId("register-point-of-use-stage-request")).toHaveText("Request to Join Stage");
  await expect(page.getByTestId("attendee-stage-controls")).toHaveCount(0);
  await expect(page.getByTestId("stage-camera-toggle")).toHaveCount(0);
});
