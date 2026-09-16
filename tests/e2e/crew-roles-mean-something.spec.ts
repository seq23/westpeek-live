import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { grantCrewAccess, isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Crew roles mean something and say so:
 *   every crew page shows "You are in as <role> · <event>", what the role may do, and Switch role;
 *   a moderator sees the whole deck but End the show / Generate RTMP / the ladder are disabled
 *   with the reason (the server refuses with the same sentence: crewServerActionsByRole.test.ts);
 *   the moderator CAN hide a chat message; the technical director CAN generate credentials and
 *   end the show but cannot moderate chat; the crew gate describes every role before the choice.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

const EVENT = "event-summit";
const CREW = `/crew/events/${EVENT}`;
const STAGE = `/venue/${EVENT}/stage`;

async function crewAs(browser: Browser, role: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await grantCrewAccess(page, role, EVENT);
  await gotoAndAssert(page, CREW);
  return { context, page };
}

async function attendeePosts(browser: Browser, text: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await asRegisteredAttendee(page, EVENT);
  await gotoAndAssert(page, STAGE);
  const form = page.getByTestId("attendee-identity-chat-form");
  await form.locator('input[name="message"]').fill(text);
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("main_stage-live-chat")).toContainText(text);
  return { context, page };
}

async function expectDisabledWithReason(page: Page, testId: string, reason: RegExp) {
  const button = page.getByTestId(testId).first();
  await expect(button).toBeDisabled();
  await expect(button.locator("xpath=ancestor::form[1]")).toHaveAttribute("title", reason);
}

test("the crew gate describes every role; a crew page shows the role badge with Switch role prefilled", async ({ page }) => {
  await gotoAndAssert(page, "/production-access/crew?event=demo&role=moderator");
  await expect(page.getByTestId("crew-role-select")).toHaveValue("moderator");
  await expect(page.getByLabel(/event code/i)).toHaveValue("demo");
  const descriptions = page.getByTestId("crew-role-descriptions");
  for (const role of ["crew", "executive_producer", "producer", "technical_director", "show_caller", "moderator", "va", "support"]) await expect(descriptions.getByTestId(`crew-role-description-${role}`)).toBeVisible();
  await expect(descriptions.getByTestId("crew-role-description-moderator")).toContainText("Cannot move the stream");
  await expect(descriptions.getByTestId("crew-role-description-executive_producer")).toContainText("The host");

  await grantCrewAccess(page, "technical_director", EVENT);
  for (const route of [CREW, `${CREW}/call-sheet`, `${CREW}/run-of-show`, `${CREW}/tasks`]) {
    await gotoAndAssert(page, route);
    const badge = page.getByTestId("crew-role-badge");
    await expect(badge.getByTestId("crew-role-label")).toHaveText("You are in as Technical Director");
    await expect(badge.getByTestId("crew-role-description")).toContainText("Owns the feed");
    await expect(badge).toHaveAttribute("data-is-host", "false");
    await expect(badge.getByTestId("crew-switch-role")).toHaveAttribute("href", /\/production-access\/crew\?event=.+&role=technical_director/);
  }
});

test("moderator: every section renders, the stream controls are disabled with the reason, the server refuses the same, and hide works", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const rude = `roles-e2e ${stamp}`;
  const attendee = await attendeePosts(browser, rude);
  const moderator = await crewAs(browser, "moderator");
  const deck = moderator.page.getByTestId("crew-live-moderation-deck");
  await expect(deck).toHaveAttribute("data-viewer-role", "moderator");
  for (const section of ["crew-go-live", "end-show-control", "speaker-roster", "attendee-live-roster", "chat-moderation-queue", "crew-live-room-controls"]) await expect(moderator.page.getByTestId(section).first()).toBeVisible();

  const reason = /^Moderator can't move the stream or end the show — that's the Executive Producer, a producer, or the Technical Director\.$/;
  await expectDisabledWithReason(moderator.page, "end-show-button", reason);
  await expectDisabledWithReason(moderator.page, "generate-rtmp-credentials", reason);
  await expectDisabledWithReason(moderator.page, "stage-signal-manual_switch_to_daily", reason);
  await expect(moderator.page.getByTestId("crew-denied-go_live").first()).toContainText("Moderator can't move the stream");
  // Cue cards are not the moderator's either; stage access and chat are.
  await expect(moderator.page.getByTestId("save-producer-notes")).toBeDisabled();
  await expect(moderator.page.getByTestId("crew-denied-manage_stage_access")).toHaveCount(0);
  await expect(moderator.page.getByTestId("crew-denied-moderate_chat")).toHaveCount(0);

  // The server refuses the same action with the same sentence: tests/unit/crewServerActionsByRole.test.ts
  // drives endTheShow with a moderator cookie and gets the reason back; here the show is simply still on.
  await expect(moderator.page.getByTestId("end-show-control").first()).toHaveAttribute("data-show-ended", "false");

  // Hide is the moderator's job, and it works.
  const queue = moderator.page.getByTestId("chat-moderation-queue");
  const row = queue.getByTestId("chat-moderation-row").filter({ hasText: rude }).first();
  await expect(row.getByRole("button", { name: "Hide" })).toBeEnabled();
  await row.getByRole("button", { name: "Hide" }).click();
  await expect(queue.getByTestId("chat-moderation-row").filter({ hasText: rude }).first().getByTestId("chat-hidden-tag")).toContainText(/hidden by crew/i);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).not.toContainText(rude);
  await queue.getByTestId("chat-moderation-row").filter({ hasText: rude }).first().getByRole("button", { name: "Restore" }).click();
  await attendee.context.close();
  await moderator.context.close();
});

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

test("technical director: can generate credentials and end the show; cannot moderate chat", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const eventId = await createNowEvent(page, `Roles TD ${Date.now()}`);
  const context = await browser.newContext();
  const td = await context.newPage();
  await grantCrewAccess(td, "technical_director", eventId);
  await gotoAndAssert(td, `/crew/events/${eventId}`);
  await expect(td.getByTestId("crew-live-moderation-deck")).toHaveAttribute("data-viewer-role", "technical_director");
  await expect(td.getByTestId("crew-role-badge").getByTestId("crew-role-label")).toHaveText("You are in as Technical Director");
  await expect(td.getByTestId("generate-rtmp-credentials")).toBeEnabled();
  await expect(td.getByTestId("end-show-button").first()).toBeEnabled();
  await expect(td.getByTestId("crew-denied-go_live")).toHaveCount(0);
  await expect(td.getByTestId("crew-denied-moderate_chat")).toContainText("Technical Director can't moderate chat");
  await expect(td.getByTestId("chat-lock-main_stage-main-stage")).toBeDisabled();
  await expect(td.getByTestId("crew-denied-manage_stage_access").first()).toContainText("Technical Director can't change who is on the stage");

  // Generate: the TD may; the fallback log records it.
  await td.getByTestId("generate-rtmp-credentials").click();
  await expect(td.getByTestId("streamyard-ingress-panel")).toContainText(/generate credentials/i);

  // End the show: the TD may; the stage is marked ended and the event is ended.
  await td.getByTestId("end-show-button").first().click();
  await expect(td.getByTestId("end-show-control").first()).toHaveAttribute("data-show-ended", "true");
  await expect(td.getByTestId("end-show-ended-badge").first()).toContainText("event ended");
  await context.close();
});
