import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * "Changing host should be super easy": the operator presses Make someone the host on the crew
 * deck → a host link with Copy and the hand-off sentence → a second browser opens the link: the
 * crew gate is PREFILLED (event code, Executive Producer, crew code), nothing submitted until
 * Enter → they land on the crew deck as the host (badge, Host pill, full deck, host panel says
 * "You are hosting"), and the lobby shows the host banner with the crew-deck link → the operator
 * revokes the link → the host's next action is refused and the crew code has rotated → the old
 * link no longer opens the deck. The production-access cards explain the four doors.
 * Local file-store run only.
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

test("the production-access cards explain the four doors in plain words", async ({ page }) => {
  await gotoAndAssert(page, "/production-access");
  await expect(page.getByTestId("owner-access-card")).toContainText("Sequoia and Scooter. The master password opens everything");
  await expect(page.getByTestId("operator-access-card")).toContainText("West Peek’s own producers and staff running the show from the control room");
  await expect(page.getByTestId("crew-access-card")).toContainText("People hired for the day — moderator, technical director, show caller, support. One event, one role, no admin.");
  await expect(page.getByTestId("special-guest-access-card")).toContainText("Speakers, sponsors, VIPs, clients");
  await expect(page.getByTestId("special-guest-access-card")).toContainText("green room and cue cards for speakers, booth for sponsors, lounge for VIPs, read-only overview for clients");
  await expect(page.locator("body")).not.toContainText("Conference Special Guest");
});

test("mint a host link → the link prefills the gate → the host runs the show → revoke ends it", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Host ${Date.now()}`);

  // 1. The operator mints the host link from the crew deck.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  const panel = page.getByTestId("host-panel");
  await expect(panel).toHaveAttribute("data-active-links", "0");
  await expect(panel.getByTestId("host-link-none")).toContainText("owner and the operator are the hosts");
  await panel.getByTestId("mint-host-link").click();
  await expect(page.getByTestId("host-panel")).toHaveAttribute("data-active-links", "1");
  const card = page.getByTestId("host-link-card");
  await expect(card).toContainText("Send this to whoever is running the show. They get the host banner, go-live, end-the-show and every control for this event only.");
  await expect(card.getByTestId("copy-host-link")).toBeVisible();
  const link = (await card.getByTestId("host-link-url").innerText()).trim();
  expect(link).toMatch(/\/production-access\/crew\?event=[^&]+&role=executive_producer&code=CREW-/);
  await expect(page.getByTestId("current-hosts")).toContainText("handed out by operator");
  // The Access page shows the same panel.
  await gotoAndAssert(page, `/app/events/${eventId}/access`);
  await expect(page.getByTestId("host-panel")).toHaveAttribute("data-active-links", "1");

  // 2. Someone opens the link: the gate is prefilled, nothing submitted until Enter.
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await gotoAndAssert(host, new URL(link).pathname + new URL(link).search);
  await expect(host).toHaveURL(/\/production-access\/crew\?event=/);
  await expect(host.getByTestId("crew-role-select")).toHaveValue("executive_producer");
  await expect(host.getByLabel(/event code/i)).not.toHaveValue("");
  await expect(host.getByLabel(/crew password/i)).toHaveAttribute("data-prefilled", "true");
  await expect(host.getByTestId("crew-code-prefilled")).toBeVisible();
  await host.getByRole("button", { name: /enter crew workspace/i }).click();
  await expect(host).toHaveURL(new RegExp(`/crew/events/${eventId}$`));

  // 3. They are the host: badge, pill, full deck, "You are hosting", and the lobby banner.
  const badge = host.getByTestId("crew-role-badge");
  await expect(badge.getByTestId("crew-role-label")).toHaveText("You are in as Executive Producer (host)");
  await expect(badge.getByTestId("crew-host-pill")).toBeVisible();
  await expect(host.getByTestId("crew-live-moderation-deck")).toHaveAttribute("data-viewer-role", "executive_producer");
  await expect(host.getByTestId("host-panel")).toContainText("You are hosting as the Executive Producer.");
  await expect(host.getByTestId("current-host-you")).toBeVisible();
  await expect(host.getByTestId("generate-rtmp-credentials")).toBeEnabled();
  await expect(host.getByTestId("end-show-button").first()).toBeEnabled();
  await expect(host.getByTestId("chat-lock-main_stage-main-stage")).toBeEnabled();
  await expect(host.getByTestId("crew-denied-go_live")).toHaveCount(0);
  await gotoAndAssert(host, `/venue/${eventId}/lobby`);
  await expect(host.getByTestId("host-join-code-banner")).toContainText("You are hosting");
  await expect(host.getByTestId("host-command-link")).toHaveAttribute("href", `/crew/events/${eventId}`);
  // The host may act: generate credentials records on the log.
  await gotoAndAssert(host, `/crew/events/${eventId}`);
  await host.getByTestId("generate-rtmp-credentials").click();
  await expect(host.getByTestId("streamyard-ingress-panel")).toContainText(/generate credentials/i);

  // 4. The operator revokes: crew code rotated, the host's cookie is refused, the old link no longer works.
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  await page.getByTestId("revoke-host-link").click();
  await expect(page.getByTestId("host-panel")).toHaveAttribute("data-active-links", "0");
  await expect(page.getByTestId("host-panel")).toHaveAttribute("data-code-version", "1");
  await expect(page.getByTestId("host-link-none")).toContainText("crew code was rotated");
  await gotoAndAssert(host, `/crew/events/${eventId}`);
  await expect(host.getByTestId("crew-role-badge").getByTestId("crew-role-label")).toHaveText("You are in as Crew link revoked");
  await expect(host.getByTestId("end-show-button").first()).toBeDisabled();
  await expect(host.getByTestId("crew-live-moderation-deck")).toHaveAttribute("data-viewer-kind", "none");
  const stale = await hostContext.newPage();
  await stale.goto(new URL(link).pathname + new URL(link).search);
  await stale.getByRole("button", { name: /enter crew workspace/i }).click();
  await expect(stale).toHaveURL(/\/production-access\/crew\?error=invalid/);
  // A fresh link carries the new code.
  await page.getByTestId("mint-host-link").click();
  const fresh = (await page.getByTestId("host-link-url").innerText()).trim();
  expect(fresh).not.toBe(link);
  await hostContext.close();
});
