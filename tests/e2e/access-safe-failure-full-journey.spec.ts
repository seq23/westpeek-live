import { expect, test } from "./fixtures";
import { expectRouteMatrix } from "./helpers/roleJourney";

test("access and safe-failure surfaces explain missing setup without crashing or leaking raw secrets", async ({ page }) => {
  await expectRouteMatrix(page, [
    { path: "/production-access", label: "production access", terms: ["production", "access"], anyOf: ["crew", "special guest", "setup"] },
    { path: "/production-access/crew", label: "crew access", anyOf: ["crew", "setup", "password"] },
    { path: "/production-access/special-guest", label: "special guest access", anyOf: ["special", "guest", "event"] },
    { path: "/production-access/setup-error", label: "setup error", anyOf: ["setup", "missing", "configure"] },
  ]);

  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("supabase_service_role_key=");
  expect(body).not.toContain("livekit_api_secret=");
  expect(body).not.toContain("daily_api_key=");
});
