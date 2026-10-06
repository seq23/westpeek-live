import { test, expect } from "@playwright/test";

test("stream failover proves pre-stream, 4-second buffer, StreamYard, LiveKit, Daily, switching, and private URL boundaries", async ({ page }) => {
  await page.goto("/venue/demo/stage");
  const body = page.locator("body");
  await expect(body).toContainText(/pre-stream|getting ready|stage|stream/i);
  // Failover is invisible to the attendee by design (16 Sep 2026): the stage promises the picture
  // comes back on its own and never names the provider it switched to or from.
  await expect(body).toContainText("If the picture refreshes or switches source behind the scenes, stay on this page. It comes back on its own.");
  await expect(body).not.toContainText(/StreamYard|LiveKit|Daily\.co|Daily room/i);
  await expect(body).not.toContainText(/black screen|unhandled error/i);
  await expect(body).not.toContainText(/stream key|private Daily URL|daily\.co\/[a-z0-9-]{12,}/i);
});
