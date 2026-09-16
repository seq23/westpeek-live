import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Lighter registration (16 Sep 2026): three fields and you are in → the stage → "Tell us more
 * about you" (collapsed, "0 of 7") saves two fields → the People page shows them and nothing
 * invented → "Hide me from the People directory" removes the attendee from People but not from the
 * crew roster → the networking gate asks for topics inline when they are missing.
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

test("register with three fields → stage → tell us more saves two fields → People shows them → hide me → networking gate asks for topics", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const eventId = await createNowEvent(page, `Lighter ${Date.now()}`);
  const context = await browser.newContext();
  const ada = await context.newPage();
  await gotoAndAssert(ada, `/events/${eventId}/register`);
  // Only name, email, company are required; title is optional; nothing else is on the page.
  await expect(ada.locator('form [required]')).toHaveCount(3);
  await expect(ada.locator('[name="reasonForAttending"], [name="topicsOfInterest"], [name="socialLinks"]')).toHaveCount(0);
  await ada.locator('[name="name"]').fill("Ada Lovelace");
  await ada.locator('[name="email"]').fill(`ada-${Date.now()}@example.com`);
  await ada.locator('[name="company"]').fill("Analytical Engines");
  await ada.getByRole("button", { name: /submit registration/i }).click();
  await expect(ada).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?registered=1/);
  await expect(ada.getByTestId("venue-header-attendee")).toContainText("Ada Lovelace");

  // The stage carries the collapsed card with a progress cue; two fields saved.
  await gotoAndAssert(ada, `/venue/${eventId}/stage`);
  const card = ada.getByTestId("attendee-profile-panel");
  await expect(card).toHaveAttribute("data-progress", "0/7");
  await expect(card.getByTestId("tell-us-more-progress")).toHaveText("0 of 7");
  await card.locator("summary").click();
  await card.getByTestId("tell-title").fill("Founder");
  await card.getByTestId("tell-fact").fill("Wrote the first program before there was a computer to run it.");
  await card.getByTestId("tell-us-more-save").click();
  await expect(ada).toHaveURL(/saved=profile/);
  await expect(ada.getByTestId("tell-us-more-saved")).toBeVisible();
  await expect(ada.getByTestId("attendee-profile-panel")).toHaveAttribute("data-progress", "2/7");

  // People shows what exists and nothing invented.
  await gotoAndAssert(ada, `/venue/${eventId}/people`);
  const me = ada.locator("details").filter({ hasText: "Ada Lovelace" }).first();
  await expect(me).toContainText("Founder · Analytical Engines");
  await me.locator("summary").click();
  await expect(me.getByTestId("person-fact")).toContainText("Wrote the first program");
  await expect(me.getByTestId("person-reason")).toHaveCount(0);
  await expect(ada.locator("body")).not.toContainText("Ask me what I am hoping to learn today");

  // Hide me: gone from People, still on the crew roster.
  await gotoAndAssert(ada, `/venue/${eventId}/lobby`);
  const lobbyCard = ada.getByTestId("attendee-profile-panel");
  await lobbyCard.locator("summary").click();
  await lobbyCard.getByTestId("tell-hide-me").check();
  await lobbyCard.getByTestId("tell-us-more-save").click();
  await expect(ada).toHaveURL(/saved=profile/);
  await gotoAndAssert(ada, `/venue/${eventId}/people`);
  await expect(ada.locator("details").filter({ hasText: "Ada Lovelace" })).toHaveCount(0);
  await gotoAndAssert(page, `/crew/events/${eventId}`);
  await expect(page.getByTestId("attendee-live-roster")).toContainText("Ada Lovelace");

  // Networking gate: no topics yet → asked inline with the join, then in the queue with topics saved.
  await gotoAndAssert(ada, `/venue/${eventId}/networking`);
  await expect(ada.getByTestId("networking-topics-gate")).toBeVisible();
  await ada.getByTestId("networking-topics-input").fill("AI\nfundraising");
  await ada.getByTestId("networking-goal-input").fill("Founders raising a seed round");
  await ada.getByTestId("networking-join").click();
  await expect(ada).toHaveURL(/state=waiting/);
  await gotoAndAssert(ada, `/venue/${eventId}/lobby`);
  await expect(ada.getByTestId("attendee-profile-panel")).toHaveAttribute("data-progress", "4/7");
  await context.close();
});
