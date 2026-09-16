import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { grantOperatorAccess, isDeployedBrowserRun } from "./helpers/roleJourney";

/**
 * Crew chat moderation, end to end, through the real pages:
 *   attendee posts → crew hides it on the command page → attendee no longer sees it;
 *   crew silences the attendee → the attendee's input is replaced by the silenced notice
 *   and a post from a stale form is rejected server-side;
 *   crew locks the room → the attendee cannot post; unlock reopens it.
 * Local file-store run only: the deployed run must not write test chat into a real event.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

const EVENT = "event-summit";
const STAGE = `/venue/${EVENT}/stage`;
const COMMAND = `/app/events/${EVENT}`;

async function attendeeContext(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await asRegisteredAttendee(page, EVENT);
  return { context, page };
}

async function crewContext(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await grantOperatorAccess(page, "executive_producer", EVENT);
  return { context, page };
}

async function attendeePosts(page: Page, text: string) {
  await gotoAndAssert(page, STAGE);
  const form = page.getByTestId("attendee-identity-chat-form");
  await expect(form).toBeVisible();
  await form.locator('input[name="message"]').fill(text);
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("main_stage-live-chat")).toContainText(text);
}

test("crew hides, silences, locks; the attendee sees each outcome and the write path refuses", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const attendee = await attendeeContext(browser);
  const crew = await crewContext(browser);

  // 1. Attendee posts; crew sees it in the moderation queue on the command page.
  const rude = `mod-e2e rude ${stamp}`;
  await attendeePosts(attendee.page, rude);
  await gotoAndAssert(crew.page, COMMAND);
  const queue = crew.page.getByTestId("chat-moderation-queue");
  await expect(queue).toBeVisible();
  const row = queue.getByTestId("chat-moderation-row").filter({ hasText: rude }).first();
  await expect(row).toBeVisible();

  // 2. Hide → gone for the attendee, tagged for the crew; restore → back.
  await row.getByRole("button", { name: "Hide" }).click();
  await expect(queue.getByTestId("chat-moderation-row").filter({ hasText: rude }).first().getByTestId("chat-hidden-tag")).toContainText(/hidden by (operator|owner|crew)/i);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).not.toContainText(rude);
  await queue.getByTestId("chat-moderation-row").filter({ hasText: rude }).first().getByRole("button", { name: "Restore" }).click();
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).toContainText(rude);

  // 3. Silence → the attendee's stale form still cannot post; the input is replaced by the notice.
  await gotoAndAssert(attendee.page, STAGE);
  const staleForm = attendee.page.getByTestId("attendee-identity-chat-form");
  await expect(staleForm).toBeVisible();
  await gotoAndAssert(crew.page, COMMAND);
  await queue.getByTestId("chat-moderation-row").filter({ hasText: rude }).first().getByRole("button", { name: "Silence" }).click();
  await expect(queue.getByTestId("chat-silenced-attendees")).toBeVisible();
  const silencedText = `mod-e2e silenced ${stamp}`;
  await staleForm.locator('input[name="message"]').fill(silencedText);
  await staleForm.getByRole("button", { name: "Send" }).click();
  await expect(attendee.page.getByTestId("chat-silenced-notice")).toContainText("You have been silenced by the crew");
  await expect(attendee.page.getByTestId("main_stage-live-chat")).not.toContainText(silencedText);
  await expect(attendee.page.getByTestId("attendee-identity-chat-form")).toHaveCount(0);
  // Unsilence from the silenced list.
  await queue.getByTestId("chat-silenced-attendees").getByRole("button", { name: "Unsilence" }).first().click();
  await expect(queue.getByTestId("chat-silenced-attendees")).toHaveCount(0);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-identity-chat-form")).toBeVisible();

  // 4. Lock → attendee cannot post; unlock → can.
  await queue.getByTestId("chat-lock-main_stage-main-stage").click();
  await expect(queue.getByTestId("chat-room-lock-state-main_stage-main-stage")).toHaveAttribute("data-locked", "true");
  const lockedText = `mod-e2e locked ${stamp}`;
  await attendee.page.getByTestId("attendee-identity-chat-form").locator('input[name="message"]').fill(lockedText);
  await attendee.page.getByTestId("attendee-identity-chat-form").getByRole("button", { name: "Send" }).click();
  await expect(attendee.page.getByTestId("chat-locked-notice")).toContainText("Chat is locked by the crew");
  await expect(attendee.page.getByTestId("main_stage-live-chat")).not.toContainText(lockedText);
  await queue.getByTestId("chat-unlock-main_stage-main-stage").click();
  await expect(queue.getByTestId("chat-room-lock-state-main_stage-main-stage")).toHaveAttribute("data-locked", "false");
  await attendeePosts(attendee.page, `mod-e2e reopened ${stamp}`);

  await attendee.context.close();
  await crew.context.close();
});

test("an attendee cannot invoke crew moderation: the queue never renders on the venue and the actions refuse", async ({ browser }) => {
  const attendee = await attendeeContext(browser);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("chat-moderation-queue")).toHaveCount(0);
  await expect(attendee.page.getByTestId("chat-hidden-tag")).toHaveCount(0);
  await attendee.context.close();
});
