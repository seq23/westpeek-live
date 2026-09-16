import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { day1Default } from "./helpers/day1AccessDefaults";
import { asRegisteredAttendee } from "./helpers/persona";
import { grantCrewAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The venue follows the event's state (the owner ended the show, refreshed /venue/<id>/stage,
 * and nothing changed — 16 Sep 2026):
 *   a registered attendee is on the stage of a live Room → the crew presses End the show →
 *   the attendee's open stage tab flips to the ended state within 15s, no reload →
 *   a refresh shows the ended state on the stage, the lobby, sessions, breakouts, expo,
 *   networking, people, help; the replay page still renders → Archive → the archived notice →
 *   a Later (draft) Room is "not open yet" for an attendee but previews for the host.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

function sign(body: string) {
  const secret = process.env.LIVEKIT_WEBHOOK_SECRET || day1Default("LIVEKIT_WEBHOOK_SECRET", "local-playwright-livekit-webhook-secret-1234567890");
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function webhook(request: APIRequestContext, eventId: string, event: "ingress_started" | "ingress_ended") {
  const body = JSON.stringify({ event, eventId, stageId: "main-stage", ingressInfo: { roomName: `${eventId}-main-stage` } });
  const response = await request.post("/api/video/livekit-webhook", { data: Buffer.from(body), headers: { "content-type": "application/json", "x-livekit-signature": sign(body) } });
  expect(response.ok()).toBeTruthy();
}

async function createEvent(page: Page, name: string, when: "now" | "later") {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId(`when-${when}`).check();
  await page.locator('[name="name"]').fill(name);
  if (when === "later") {
    const startAt = page.locator('[name="startAt"]');
    if (await startAt.count()) await startAt.fill("2030-01-01T10:00");
  }
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(when === "now" ? /\/venue\/[a-z0-9-]+\/lobby\?created=1/ : /\/app\/events\/[a-z0-9-]+\?created=1/);
  const parts = new URL(page.url()).pathname.split("/");
  return when === "now" ? parts[2] : parts[3];
}

const SURFACES = ["lobby", "stage", "sessions", "breakouts", "expo", "networking", "people", "help", "run-of-show"];

test("End the show reaches an open attendee stage tab within 15s; every venue page shows ended; Archive shows archived", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const eventId = await createEvent(page, `Follows State ${Date.now()}`, "now");
  await webhook(request, eventId, "ingress_started");

  const attendeeContext = await browser.newContext();
  const attendee = await attendeeContext.newPage();
  await asRegisteredAttendee(attendee, eventId);
  await gotoAndAssert(attendee, `/venue/${eventId}/stage`);
  await expect(attendee.locator("main")).toHaveAttribute("data-venue-gate", "open");
  await expect(attendee.getByTestId("stage-player")).toBeVisible();

  // The crew (a technical director through the crew deck) ends the show.
  const crewContext = await browser.newContext();
  const crew = await crewContext.newPage();
  await grantCrewAccess(crew, "technical_director", eventId);
  await gotoAndAssert(crew, `/crew/events/${eventId}`);
  await crew.getByTestId("end-show-button").first().click();
  await expect(crew.getByTestId("end-show-control").first()).toHaveAttribute("data-show-ended", "true");

  // The attendee's open tab flips on its own.
  await expect(attendee.getByTestId("venue-state-notice")).toHaveAttribute("data-gate", "ended", { timeout: 15_000 });
  await expect(attendee.getByTestId("venue-state-headline")).toHaveText("Event ended. Replay access is available.");
  await expect(attendee.getByTestId("stage-player")).toHaveCount(0);
  await expect(attendee.getByTestId("venue-state-replay-link")).toHaveAttribute("href", `/venue/${eventId}/replay`);

  // A refresh, and every other venue page, says the same; the replay page still renders.
  for (const surface of SURFACES) {
    await gotoAndAssert(attendee, `/venue/${eventId}/${surface}`);
    await expect(attendee.locator("main"), surface).toHaveAttribute("data-venue-gate", "ended");
    await expect(attendee.getByTestId("venue-state-notice"), surface).toBeVisible();
  }
  await gotoAndAssert(attendee, `/venue/${eventId}/replay`);
  await expect(attendee.locator("main")).toHaveAttribute("data-venue-gate", "open");
  await expect(attendee.locator("body")).toContainText("Replay center");
  // The host sees the same ended state, with a way back to the command center.
  await gotoAndAssert(page, `/venue/${eventId}/stage`);
  await expect(page.getByTestId("venue-state-notice")).toHaveAttribute("data-gate", "ended");
  await expect(page.getByTestId("venue-state-host-link")).toBeVisible();

  // Archive → archived notice, even on the replay page.
  await gotoAndAssert(page, `/app/events/${eventId}`);
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page).toHaveURL(/archived=/);
  await gotoAndAssert(attendee, `/venue/${eventId}/lobby`);
  await expect(attendee.getByTestId("venue-state-notice")).toHaveAttribute("data-gate", "archived");
  await expect(attendee.getByTestId("venue-state-headline")).toHaveText("This event is archived and no longer publicly available.");
  await gotoAndAssert(attendee, `/venue/${eventId}/replay`);
  await expect(attendee.getByTestId("venue-state-notice")).toHaveAttribute("data-gate", "archived");
  await attendeeContext.close();
  await crewContext.close();
});

test("a draft Room is not open for an attendee but previews for the host; Publish opens it without a reload", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const eventId = await createEvent(page, `Draft Follows ${Date.now()}`, "later");
  await gotoAndAssert(page, `/venue/${eventId}/lobby`);
  await expect(page.locator("main")).toHaveAttribute("data-venue-gate", "open");
  await expect(page.getByTestId("host-join-code-banner")).toBeVisible();

  const attendeeContext = await browser.newContext();
  const attendee = await attendeeContext.newPage();
  await asRegisteredAttendee(attendee, eventId);
  await gotoAndAssert(attendee, `/venue/${eventId}/stage`);
  await expect(attendee.getByTestId("venue-state-notice")).toHaveAttribute("data-gate", "draft");
  await expect(attendee.getByTestId("venue-state-headline")).toHaveText("This event is not publicly open yet.");

  await gotoAndAssert(page, `/app/events/${eventId}/publish`);
  await page.getByTestId("publish-live").click();
  await expect(page).toHaveURL(/updated=live|\/lobby\?created=1/);
  await expect(attendee.locator("main")).toHaveAttribute("data-venue-gate", "open", { timeout: 15_000 });
  await expect(attendee.getByTestId("stage-player")).toBeVisible();
  await attendeeContext.close();
});
