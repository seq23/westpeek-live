import { expect, test } from "./fixtures";
import { expectVisibleRoute, loginAsOperator, isDeployedBrowserRun } from "./helpers/roleJourney";

test("producer console exposes StreamYard ingress credentials and failover decisioning", async ({ page }) => {
  const eventId = process.env.TIER4_EVENT_ID || process.env.STREAMYARD_E2E_EVENT_ID || "demo";
  await loginAsOperator(page, `/admin/testing/${eventId}`);
  await expectVisibleRoute(page, { path: `/admin/testing/${eventId}`, label: "testing console", anyOf: ["streamyard", "ingress", "fallback", "daily"] });
  if (isDeployedBrowserRun()) return;
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const term of ["click to copy rtmp url", "click to copy stream key", "failure plane", "keep streamyard running", "switch attendees to daily"]) {
    expect(body).toContain(term);
  }
});
