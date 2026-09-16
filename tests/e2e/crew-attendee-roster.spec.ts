import { expect, test, type Browser, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { asRegisteredAttendee } from "./helpers/persona";
import { grantCrewAccess, grantOperatorAccess, isDeployedBrowserRun } from "./helpers/roleJourney";

/**
 * The roster replaces the hand-typed attendee id, and the controls live where the crew is:
 *   crew console (event-scoped crew cookie) opens attendee camera requests →
 *   registered attendee requests the stage → the request is pending on the crew console →
 *   crew approves → the attendee sees the stage approval →
 *   crew revokes from the roster row → attendee sees revoked → crew permits → attendee sees permitted.
 * The operator command page renders the same deck. Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey; deployed proof is the owner's throwaway event");

const EVENT = "event-summit";
const ATTENDEE_ID = `e2e-attendee-${EVENT}`;
const STAGE = `/venue/${EVENT}/stage`;
const CREW = `/crew/events/${EVENT}`;
const COMMAND = `/app/events/${EVENT}`;

async function attendeeContext(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await asRegisteredAttendee(page, EVENT);
  return { context, page };
}

async function crewPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await grantCrewAccess(page, "producer", EVENT);
  return { context, page };
}

async function setMainStageCamera(page: Page, enabled: boolean) {
  await gotoAndAssert(page, CREW);
  const form = page.getByTestId("live-room-control-forms").locator("form").first();
  const camera = form.locator('input[name="globalCameraEnabled"]');
  if ((await camera.isChecked()) !== enabled) await camera.setChecked(enabled);
  await form.getByRole("button", { name: "Save main stage controls" }).click();
  await expect(page.getByTestId("live-room-control-forms").locator("form").first().locator('input[name="globalCameraEnabled"]')).toBeChecked({ checked: enabled });
}

async function expectStatus(page: Page, status: string) {
  await expect(page.getByTestId(`roster-status-${ATTENDEE_ID}`)).toHaveAttribute("data-live-status", status);
}

/** Back to "registered, no decision" so each test starts from the same place. */
async function resetAttendee(page: Page) {
  await gotoAndAssert(page, CREW);
  const reset = page.getByTestId(`roster-reset-${ATTENDEE_ID}`);
  if (await reset.count()) {
    await reset.click();
    await expectStatus(page, "open");
  }
}

test("pending request → approve → revoke → permit, all from the crew console roster; the command page shows the same", async ({ browser }) => {
  test.setTimeout(120_000);
  const attendee = await attendeeContext(browser);
  const crew = await crewPage(browser);

  await gotoAndAssert(crew.page, CREW);
  await expect(crew.page.getByTestId("crew-live-moderation-deck")).toBeVisible();
  await expect(crew.page.getByTestId("attendee-live-roster")).toBeVisible();
  await expect(crew.page.getByTestId("chat-moderation-queue")).toBeVisible();
  const row = crew.page.getByTestId(`roster-row-${ATTENDEE_ID}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText("E2E Registered Attendee");
  await expect(row).toContainText("E2E Company");

  await resetAttendee(crew.page);
  await setMainStageCamera(crew.page, true);

  // 1. The attendee asks for the stage; the crew sees it pending.
  await gotoAndAssert(attendee.page, STAGE);
  await attendee.page.getByTestId("attendee-stage-request-form").getByRole("button", { name: "Request to Join Stage" }).click();
  await expect(attendee.page.getByTestId("attendee-stage-request-pending")).toBeVisible();
  await gotoAndAssert(crew.page, CREW);
  const pending = crew.page.getByTestId(`pending-request-${ATTENDEE_ID}`);
  await expect(pending).toBeVisible();
  await expect(pending).toContainText("E2E Registered Attendee");
  await expectStatus(crew.page, "requested");

  // 2. Approve from the pending queue → attendee sees the stage approval.
  await pending.getByRole("button", { name: "Approve" }).click();
  await expect(crew.page.getByTestId(`pending-request-${ATTENDEE_ID}`)).toHaveCount(0);
  await expectStatus(crew.page, "approved_to_publish");
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-stage-approved")).toBeVisible();

  // 3. Revoke from the row → attendee sees revoked.
  await crew.page.getByTestId(`roster-revoke-${ATTENDEE_ID}`).click();
  await expectStatus(crew.page, "revoked");
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-live-access-revoked")).toBeVisible();

  // 4. Permit to watch → attendee sees permitted (no publish).
  await crew.page.getByTestId(`roster-permit-${ATTENDEE_ID}`).click();
  await expectStatus(crew.page, "permitted");
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-live-access-permitted")).toBeVisible();
  await expect(attendee.page.getByTestId("attendee-stage-approved")).toHaveCount(0);

  // 5. The operator command page renders the same deck with the same status.
  const operatorContext = await browser.newContext();
  const operator = await operatorContext.newPage();
  await grantOperatorAccess(operator, "executive_producer", EVENT);
  await gotoAndAssert(operator, COMMAND);
  await expect(operator.getByTestId("crew-live-moderation-deck")).toBeVisible();
  await expectStatus(operator, "permitted");
  await operatorContext.close();

  await setMainStageCamera(crew.page, false);
  await resetAttendee(crew.page);
  await attendee.context.close();
  await crew.context.close();
});

test("decline closes the request without granting; the attendee can ask again; search narrows the roster", async ({ browser }) => {
  test.setTimeout(120_000);
  const attendee = await attendeeContext(browser);
  const crew = await crewPage(browser);
  await resetAttendee(crew.page);
  await setMainStageCamera(crew.page, true);

  await gotoAndAssert(attendee.page, STAGE);
  await attendee.page.getByTestId("attendee-stage-request-form").getByRole("button", { name: "Request to Join Stage" }).click();
  await expect(attendee.page.getByTestId("attendee-stage-request-pending")).toBeVisible();

  await gotoAndAssert(crew.page, CREW);
  await crew.page.getByTestId(`pending-request-${ATTENDEE_ID}`).getByRole("button", { name: "Decline" }).click();
  await expect(crew.page.getByTestId(`pending-request-${ATTENDEE_ID}`)).toHaveCount(0);
  await expectStatus(crew.page, "declined");

  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-stage-request-declined")).toBeVisible();
  await expect(attendee.page.getByTestId("attendee-stage-request-form")).toBeVisible();

  await gotoAndAssert(crew.page, `${CREW}?roster=E2E%20Registered`);
  await expect(crew.page.getByTestId(`roster-row-${ATTENDEE_ID}`)).toBeVisible();
  await gotoAndAssert(crew.page, `${CREW}?roster=nobody-with-this-name`);
  await expect(crew.page.getByTestId("roster-table")).toContainText("No registered attendee matches");

  await setMainStageCamera(crew.page, false);
  await resetAttendee(crew.page);
  await attendee.context.close();
  await crew.context.close();
});

test("an attendee never sees the crew deck on the crew console or the venue", async ({ browser }) => {
  const attendee = await attendeeContext(browser);
  await attendee.page.goto(CREW);
  await expect(attendee.page.getByTestId("crew-live-moderation-deck")).toHaveCount(0);
  await gotoAndAssert(attendee.page, STAGE);
  await expect(attendee.page.getByTestId("attendee-live-roster")).toHaveCount(0);
  await attendee.context.close();
});
