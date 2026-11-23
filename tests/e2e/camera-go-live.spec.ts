import { expect, test, type Page } from "./fixtures";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { grantCrewAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * "Go live with my device camera … super simple to switch between a streamyard live stream and
 * using the device built in camera" (23 Nov 2026). One switch, StreamYard or My camera, on the
 * Go-live card; a one-tap "Go live with my camera" on the stage page for a host. This local run has
 * no LiveKit, which is exactly the outage case: the tap says why in plain words and nothing goes
 * live. The live LiveKit path is proven by the reducer/action/route tests in tests/unit and by the
 * owner's two-browser pass.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

/** The click-through's "console clean": every page error and console error, minus the expected 4xx/5xx resource lines of the refusals we provoke. */
function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  return errors;
}

async function createLaterEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-later").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/app\/events\/[a-z0-9-]+\?created=1/);
  return new URL(page.url()).pathname.split("/")[3];
}

test("the Go-live card has one source switch: StreamYard marked, My camera refused in plain words when LiveKit is not there, nothing goes live", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchConsole(page);
  const eventId = await createLaterEvent(page, `Camera Switch ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  const card = page.getByTestId("go-live-card");
  const sw = card.getByTestId("stage-source-switch");
  await expect(sw.getByTestId("stage-source-switch-streamyard")).toHaveAttribute("aria-pressed", "true");
  await expect(sw.getByTestId("stage-source-switch-cameras")).toHaveAttribute("aria-pressed", "false");
  for (const id of ["stage-source-switch-streamyard", "stage-source-switch-cameras"]) {
    const box = await sw.getByTestId(id).boundingBox();
    expect(box && box.height >= 44 && box.width >= 44, `${id} is a 44 px tap target`).toBe(true);
  }
  // No sideways scroll at phone width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  // The pre-stream path for StreamYard is untouched: the Go live button is still there.
  await expect(card.getByTestId("go-live-button")).toBeVisible();

  await sw.getByTestId("stage-source-switch-cameras").click();
  const message = sw.getByTestId("stage-source-switch-message");
  await expect(message).toHaveAttribute("data-ok", "false");
  await expect(message).toContainText(/LiveKit/);
  await expect(message).toContainText(/Nothing changed/);
  await expect(card).toHaveAttribute("data-status", "draft");
  await expect(sw.getByTestId("stage-source-switch-streamyard")).toHaveAttribute("aria-pressed", "true");
  const res = await page.request.get(`/api/video/stage-stream-state?eventId=${eventId}&stageId=main-stage`);
  const json = await res.json();
  expect(json.state.streamStatus).not.toMatch(/_LIVE$/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(sw.getByTestId("stage-source-switch-streamyard")).toBeVisible();
  expect(errors).toEqual([]);
});

test("crew deck: a role that may not go live sees the switch disabled and the server refuses it; a go_live role gets it at 390 px", async ({ page }) => {
  test.setTimeout(180_000);
  const eventId = await createLaterEvent(page, `Camera Roles ${Date.now()}`);
  await page.context().clearCookies();
  await grantCrewAccess(page, "moderator", eventId);
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  const sw = page.getByTestId("stage-source-switch").first();
  await expect(sw.getByTestId("stage-source-switch-cameras")).toBeDisabled();
  await expect(sw.getByTestId("stage-source-switch-message")).toContainText(/can't|cannot|Executive Producer|producer/i);
  // A forged host-token request from the same moderator is refused at the route.
  const token = await page.request.post("/api/video/livekit-token", { data: { eventId, roomId: `${eventId}-main`, roomType: "main_stage", role: "host", displayName: "Forged" } });
  expect(token.status()).toBe(403);

  // The crew deck at 390 px for a crew role that may go live: the same switch, enabled, same refusal.
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchConsole(page);
  await page.context().clearCookies();
  await grantCrewAccess(page, "technical_director", eventId);
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  const deck = page.getByTestId("stage-source-switch").first();
  await expect(deck.getByTestId("stage-source-switch-streamyard")).toHaveAttribute("aria-pressed", "true");
  const box = await deck.getByTestId("stage-source-switch-cameras").boundingBox();
  expect(box && box.height >= 44).toBe(true);
  await deck.getByTestId("stage-source-switch-cameras").click();
  await expect(deck.getByTestId("stage-source-switch-message")).toContainText(/Nothing changed/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("a host on the stage page gets one tap to go live with their camera; with LiveKit down it says so and nothing goes live", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchConsole(page);
  const eventId = await createLaterEvent(page, `Camera Stage ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  await page.getByTestId("go-live-card").getByTestId("go-live-button").click();
  await expect(page.getByTestId("go-live-card")).toHaveAttribute("data-status", "live");
  await gotoAndAssert(page, `/venue/${eventId}/stage`);
  const go = page.getByTestId("host-go-live-camera");
  await expect(go).toBeVisible();
  const box = await go.boundingBox();
  expect(box && box.height >= 44).toBe(true);
  await go.click();
  await expect(page.getByTestId("attendee-stage-device-error")).toContainText(/LiveKit/);
  await expect(page.getByTestId("host-go-live-camera")).toBeVisible();
  const json = await (await page.request.get(`/api/video/stage-stream-state?eventId=${eventId}&stageId=main-stage`)).json();
  expect(json.state.streamStatus).not.toBe("LIVEKIT_CAMERAS_LIVE");
  expect(errors).toEqual([]);
});

test("the Owner Console Live-now row carries the same switch at 390 px", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createLaterEvent(page, `Console Camera ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  await page.getByTestId("go-live-card").getByTestId("go-live-button").click();
  await expect(page.getByTestId("go-live-card")).toHaveAttribute("data-status", "live");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await context.newPage();
  const errors = watchConsole(owner);
  await gotoAndAssert(owner, "/production-access/owner?next=/app/owner");
  await owner.getByLabel(/owner master password/i).fill(process.env.E2E_OWNER_PASSWORD || requiredDay1Default("OWNER_MASTER_ACCESS_PASSWORD"));
  await owner.getByRole("button", { name: /enter owner workspace/i }).click();
  await expect(owner).toHaveURL(/\/app\/owner$/);
  const row = owner.getByTestId(`console-live-${eventId}`);
  await expect(row.getByTestId("stage-source-switch-streamyard")).toHaveAttribute("aria-pressed", "true");
  await expect(row.getByTestId(`console-live-feed-${eventId}`)).toContainText(/StreamYard/);
  const box = await row.getByTestId("stage-source-switch-cameras").boundingBox();
  expect(box && box.height >= 44).toBe(true);
  await row.getByTestId("stage-source-switch-cameras").click();
  await expect(row.getByTestId("stage-source-switch-message")).toContainText(/Nothing changed/);
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});
