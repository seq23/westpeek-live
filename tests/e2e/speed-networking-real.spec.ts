import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Real speed networking, two browsers:
 *   both register → both join the queue → matched within 10s → each sees the other's name,
 *   company, title, and the countdown; the crew card counts them → Next match returns both to
 *   waiting → End networking leaves → the crew closes networking and the waiting attendee is told.
 * The LiveKit room itself needs a real server (the deployed check); here the match card must
 * still render with the room name and ask for its token. Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

/** A second, real registration through the form (the persona helper seeds one fixed attendee per event). */
async function registerAttendee(browser: Browser, eventId: string, who: { name: string; company: string; title: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await gotoAndAssert(page, `/events/${eventId}/register`);
  await page.locator('[name="name"]').fill(who.name);
  await page.locator('[name="email"]').fill(`${who.name.toLowerCase().replace(/\s+/g, ".")}-${Date.now()}@example.com`);
  await page.locator('[name="company"]').fill(who.company);
  await page.locator('[name="title"]').fill(who.title);
  await page.getByRole("button", { name: /submit registration/i }).click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?registered=1/);
  return { context, page };
}

test("two attendees join → matched within 10s with names and timer → Next match → waiting → crew card and close", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Networking ${Date.now()}`);

  const adaContext = await browser.newContext();
  const ada = await adaContext.newPage();
  await asRegisteredAttendee(ada, eventId); // "E2E Registered Attendee · E2E Company · Founder"
  const grace = await registerAttendee(browser, eventId, { name: "Grace Hopper", company: "US Navy", title: "Admiral" });

  // Not registered → register link; registered → the real Join queue form.
  const stranger = await browser.newPage();
  await gotoAndAssert(stranger, `/venue/${eventId}/networking`);
  await expect(stranger.getByTestId("networking-registration-required")).toBeVisible();
  await expect(stranger.getByTestId("networking-register-link")).toHaveAttribute("href", `/events/${eventId}/register?reason=networking`);
  await stranger.close();

  await gotoAndAssert(ada, `/venue/${eventId}/networking`);
  await expect(ada.getByTestId("networking-live")).toHaveAttribute("data-networking-status", "idle");
  // The networking gate asks for topics inline when the profile has none (the seeded persona has none).
  const adaGate = ada.getByTestId("networking-topics-gate");
  if (await adaGate.count()) await adaGate.getByTestId("networking-topics-input").fill("AI");
  await ada.getByTestId("attendee-networking-queue-form").getByTestId("networking-join").click();
  await expect(ada).toHaveURL(/state=waiting&queued=1/);
  await expect(ada.getByTestId("networking-waiting")).toBeVisible();
  await expect(ada.getByTestId("networking-queue-count")).toContainText("1 person in the queue");

  // The crew card counts one waiting.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  const card = page.getByTestId("networking-crew-card");
  await expect(card).toHaveAttribute("data-queue-size", "1");
  await expect(card).toHaveAttribute("data-match-minutes", "4");
  await expect(card.getByTestId("networking-waiting-names")).toContainText("E2E Registered Attendee");

  // Grace joins: both are matched within 10s, each sees the other, the timer counts down from ~4:00.
  await gotoAndAssert(grace.page, `/venue/${eventId}/networking`);
  const graceGate = grace.page.getByTestId("networking-topics-gate");
  if (await graceGate.count()) await graceGate.getByTestId("networking-topics-input").fill("Navy, compilers");
  await grace.page.getByTestId("attendee-networking-queue-form").getByTestId("networking-join").click();
  const graceMatch = grace.page.getByTestId("networking-match");
  await expect(graceMatch).toBeVisible({ timeout: 10_000 });
  await expect(graceMatch.getByTestId("networking-partner-name")).toHaveText("E2E Registered Attendee");
  await expect(graceMatch.getByTestId("networking-partner-detail")).toContainText("E2E Company · Founder");
  const adaMatch = ada.getByTestId("networking-match");
  await expect(adaMatch).toBeVisible({ timeout: 10_000 });
  await expect(adaMatch.getByTestId("networking-partner-name")).toHaveText("Grace Hopper");
  await expect(adaMatch.getByTestId("networking-partner-detail")).toContainText("US Navy · Admiral");
  expect(await adaMatch.getAttribute("data-match-id")).toBe(await graceMatch.getAttribute("data-match-id"));
  const room = (await adaMatch.getAttribute("data-room"))!;
  expect(room).toMatch(new RegExp(`^${eventId}-net-`));
  const seconds = Number(await adaMatch.getByTestId("networking-timer").getAttribute("data-seconds-left"));
  expect(seconds).toBeGreaterThan(200);
  expect(seconds).toBeLessThanOrEqual(240);
  await expect(adaMatch.getByTestId("networking-timer")).toContainText(/^Time left\s*3:[0-5]\d$/);
  // The match card asked for its token (a real LiveKit room needs the deployed server; locally the answer is a named error, never a hang).
  await expect(adaMatch).toHaveAttribute("data-room-state", /token-issued|token-error/, { timeout: 10_000 });
  // A third attendee never gets this pair's room token.
  const third = await registerAttendee(browser, eventId, { name: "Linus Torvalds", company: "Kernel", title: "BDFL" });
  const stolen = await third.page.request.post("/api/video/livekit-token", { data: { eventId, roomId: room, roomType: "speed_networking", role: "attendee" } });
  expect(stolen.status()).toBe(403);
  expect((await stolen.json()).error).toMatch(/only to the two matched attendees/);

  // The crew card shows the match in progress.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  await expect(page.getByTestId("networking-crew-card")).toHaveAttribute("data-matches-in-progress", "1");
  await expect(page.getByTestId("networking-active-matches")).toContainText("E2E Registered Attendee");
  await expect(page.getByTestId("networking-active-matches")).toContainText("Grace Hopper");

  // Next match: Ada presses it; both return to waiting (Grace within a poll). They never meet again.
  await adaMatch.getByTestId("networking-next").click();
  await expect(ada).toHaveURL(/state=waiting&next=1/);
  await expect(ada.getByTestId("networking-waiting")).toBeVisible();
  await expect(grace.page.getByTestId("networking-waiting")).toBeVisible({ timeout: 10_000 });
  await expect(ada.getByTestId("networking-match")).toHaveCount(0);

  // Linus joins: he is paired with one of them; the other keeps waiting (Ada and Grace have met).
  await gotoAndAssert(third.page, `/venue/${eventId}/networking`);
  const linusGate = third.page.getByTestId("networking-topics-gate");
  if (await linusGate.count()) await linusGate.getByTestId("networking-topics-input").fill("kernels");
  await third.page.getByTestId("attendee-networking-queue-form").getByTestId("networking-join").click();

  await expect(third.page.getByTestId("networking-match")).toBeVisible({ timeout: 10_000 });
  await expect(third.page.getByTestId("networking-partner-name")).toHaveText(/E2E Registered Attendee|Grace Hopper/);

  // End networking leaves the queue; the crew closes networking and the waiting attendee is told.
  await third.page.getByTestId("networking-end").click();
  await expect(third.page).toHaveURL(/state=left/);
  await expect(third.page.getByTestId("attendee-networking-queue-form")).toBeVisible();
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  await page.getByTestId("networking-toggle-open").click();
  await expect(page.getByTestId("networking-crew-card")).toHaveAttribute("data-open", "false");
  const waitingOne = (await ada.getByTestId("networking-waiting").count()) ? ada : grace.page;
  await expect(waitingOne.getByTestId("networking-closed")).toBeVisible({ timeout: 15_000 });

  await adaContext.close();
  await grace.context.close();
  await third.context.close();
});
