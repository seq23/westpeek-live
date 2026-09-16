import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { grantOperatorAccess, isDeployedBrowserRun } from "./helpers/roleJourney";

/**
 * Chat at scale, end to end, through the real pages:
 *   crew turns slow mode on → the attendee's composer counts down and refuses the second post
 *   inside the window, and takes it once the window has passed;
 *   the crew's own composer is exempt while slow mode is on;
 *   crew clears the room → it empties for a SECOND viewer who never pressed anything, and the
 *   crew's own view empties too (a clear is a clear for everyone).
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

async function send(page: Page, text: string) {
  const form = page.getByTestId("attendee-identity-chat-form");
  await form.locator('input[name="message"]').fill(text);
  await form.getByTestId("chat-send-button").click();
}

async function setSlowMode(page: Page, seconds: string) {
  const control = page.getByTestId("chat-slow-mode-main_stage-main-stage");
  await control.getByRole("combobox").selectOption(seconds);
  await control.getByTestId("chat-slow-mode-save-main_stage-main-stage").click();
  await expect(page.getByTestId("chat-room-lock-state-main_stage-main-stage")).toHaveAttribute("data-slow-mode", seconds);
}

test("slow mode paces attendees and exempts the crew; the write path refuses the early post", async ({ browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now().toString(36);
  const attendee = await attendeeContext(browser);
  const crew = await crewContext(browser);

  // 1. Crew turns slow mode on for the main stage.
  await gotoAndAssert(crew.page, COMMAND);
  await setSlowMode(crew.page, "5");

  // 2. The attendee's room says so, and the composer carries the countdown.
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).toHaveAttribute("data-chat-slow-mode", "5");
  await expect(attendee.page.getByTestId("chat-slow-mode-badge")).toBeVisible();
  const first = `slow-e2e first ${stamp}`;
  await send(attendee.page, first);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).toContainText(first);

  // 3. Inside the window the composer counts down and Send is disabled; the write path agrees.
  await expect(attendee.page.getByTestId("chat-slow-mode-countdown")).toContainText(/second/);
  await expect(attendee.page.getByTestId("chat-send-button")).toBeDisabled();
  const early = `slow-e2e early ${stamp}`;
  // Bypass the disabled button the way a stale tab would: submit the form directly.
  await attendee.page.getByTestId("attendee-identity-chat-form").locator('input[name="message"]').fill(early);
  await attendee.page.getByTestId("attendee-identity-chat-form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await attendee.page.waitForTimeout(1_500);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).not.toContainText(early);

  // 4. Once the window has passed, the same attendee posts again.
  await attendee.page.waitForTimeout(6_000);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("chat-send-button")).toBeEnabled();
  const later = `slow-e2e later ${stamp}`;
  await send(attendee.page, later);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).toContainText(later);

  // 5. The crew's own composer says it is exempt and never counts down.
  await gotoAndAssert(crew.page, STAGE);
  await expect(crew.page.getByTestId("attendee-identity-chat-form")).toHaveAttribute("data-slow-mode-exempt", "true");
  await expect(crew.page.getByTestId("chat-slow-mode-countdown")).toHaveCount(0);

  // 6. Off again.
  await gotoAndAssert(crew.page, COMMAND);
  await setSlowMode(crew.page, "0");

  await attendee.context.close();
  await crew.context.close();
});

test("clear chat empties the room for a second viewer, and the confirm names the number", async ({ browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now().toString(36);
  const attendee = await attendeeContext(browser);
  const watcher = await attendeeContext(browser);
  const crew = await crewContext(browser);

  const text = `clear-e2e ${stamp}`;
  await gotoAndAssert(attendee.page, STAGE);
  await send(attendee.page, text);
  await expect(attendee.page.getByTestId("main_stage-live-chat")).toContainText(text);

  // A second viewer, who presses nothing, is holding the message.
  await gotoAndAssert(watcher.page, STAGE);
  await expect(watcher.page.getByTestId("main_stage-live-chat")).toContainText(text);

  // Crew clears, through the confirm that names how many and says it cannot be undone.
  await gotoAndAssert(crew.page, COMMAND);
  const clear = crew.page.getByTestId("chat-clear-main_stage-main-stage");
  crew.page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/Clear \d+ messages? from Main stage chat\?/);
    expect(dialog.message()).toContain("cannot be undone");
    await dialog.accept();
  });
  await clear.getByRole("button").click();

  // Empty for the second viewer — who polls, and never reloaded by hand — and for the crew.
  await expect(watcher.page.getByTestId("live-chat-stream")).toHaveAttribute("data-message-count", "0", { timeout: 20_000 });
  await gotoAndAssert(crew.page, STAGE);
  await expect(crew.page.getByTestId("main_stage-live-chat")).not.toContainText(text);

  await attendee.context.close();
  await watcher.context.close();
  await crew.context.close();
});
