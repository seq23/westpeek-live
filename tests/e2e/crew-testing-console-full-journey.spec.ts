import { expect, test } from "./fixtures";
import { expectVisibleRoute, loginAsOperator, isDeployedBrowserRun } from "./helpers/roleJourney";

test("crew testing console is a showtime readiness cockpit with provider, matchmaking, route, and fallback decisions", async ({ page }) => {
  await loginAsOperator(page, "/admin/testing/demo");
  await expectVisibleRoute(page, {
    path: "/admin/testing/demo",
    label: "crew testing console",
    terms: ["testing console"],
    anyOf: ["showtime", "barometer", "fallback", "livekit"],
  });

  if (isDeployedBrowserRun()) return;

  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const term of [
    "showtime readiness",
    "go / no-go",
    "livestream",
    "livekit",
    "daily",
    "zoom",
    "google meet",
    "matchmaking",
    "networking",
    "run of show",
    "route health",
    "debug",
    "fix",
    "switch",
  ]) {
    expect(body, `testing console should expose ${term}`).toContain(term);
  }

  await expect(page.getByTestId("showtime-readiness-barometer")).toBeVisible();
  await expect(page.getByTestId("fallback-decision-helper")).toBeVisible();
  await expect(page.getByTestId("major-system-health-grid")).toBeVisible();
});
