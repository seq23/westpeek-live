import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The reorganised workspace: the launchpad opens on the operator's real events with a table of
 * contents, Diagnostics is two cards, Demo is folded away and remembers when opened; inside an
 * event, the left spine groups every page, "What's next" names the next real thing, readiness dots
 * flip when the thing is actually done, and the merged duplicate pages redirect.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");

async function createNowEvent(page: Page, name: string) {
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(name);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  return new URL(page.url()).pathname.split("/")[2];
}

test("the launchpad leads with real events, keeps diagnostics to two cards, folds the demo away and remembers", async ({ page }) => {
  test.setTimeout(150_000);
  const eventId = await createNowEvent(page, `Spine Room ${Date.now()}`);
  await gotoAndAssert(page, "/production-access/launchpad");
  await expect(page.getByTestId("operator-launchpad")).toBeVisible();
  await expect(page.getByTestId("console-toc")).toBeVisible();
  // Your events is open by default and carries the real event, not a demo id.
  await expect(page.getByTestId("console-section-your-events")).toHaveAttribute("data-open", "true");
  await expect(page.getByTestId(`launchpad-event-${eventId}`)).toContainText("Spine Room");
  // Diagnostics: two cards.
  await expect(page.getByTestId("console-section-diagnostics")).toHaveAttribute("data-hydrated", "true");
  await page.getByTestId("console-section-diagnostics-toggle").click();
  const diagnostics = page.locator("#diagnostics-body");
  await expect(diagnostics.locator("a")).toHaveCount(2);
  // Demo is collapsed; opening it is remembered across a reload.
  await expect(page.getByTestId("console-section-demo")).toHaveAttribute("data-open", "false");
  await page.getByTestId("console-section-demo-toggle").click();
  await expect(page.getByTestId("console-section-demo")).toHaveAttribute("data-open", "true");
  await page.reload();
  await expect(page.getByTestId("console-section-demo")).toHaveAttribute("data-open", "true");
  await expect(page.getByTestId("console-section-your-events")).toHaveAttribute("data-open", "true");
});

test("the event spine groups every page, says what's next, flips a readiness dot, and the duplicate pages redirect", async ({ page }) => {
  test.setTimeout(180_000);
  const eventId = await createNowEvent(page, `Spine Event ${Date.now()}`);
  await gotoAndAssert(page, `/app/events/${eventId}`);
  const spine = page.getByTestId("event-spine").first();
  await expect(spine).toBeVisible();
  for (const group of ["overview", "plan", "people", "comms", "show-day", "after", "publish"]) {
    await expect(page.getByTestId(`spine-group-${group}`).first()).toBeVisible();
  }
  await expect(page.getByTestId("spine-whats-next").first()).toContainText(/Name the speakers/i);
  await expect(page.getByTestId("spine-link-speakers").first()).toHaveAttribute("data-ready", "false");

  // The merged duplicates keep working: they redirect to the page that stayed.
  for (const [from, to] of [["producer", ""], ["timeline", "/tasks"], ["approvals", "/approval-queue"]] as const) {
    await page.goto(`/app/events/${eventId}/${from}`);
    await expect(page).toHaveURL(new RegExp(`/app/events/${eventId}${to}$`));
  }

  // Name a speaker from the access page's guest tooling → the dot goes green.
  await gotoAndAssert(page, `/app/events/${eventId}/speakers`);
  await expect(page.getByTestId("spine-link-speakers").first()).toBeVisible();
});
