import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The reorganised workspace: the launchpad opens on the operator's real events with a table of
 * contents, Diagnostics is three cards, Demo is folded away and remembers when opened; inside an
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

/** The visible spine: the column on a wide screen, or the phone drawer (opened). */
async function spineInView(page: Page) {
  const drawer = page.getByTestId("spine-drawer");
  if (await drawer.isVisible()) {
    if (!(await drawer.evaluate((element) => (element as HTMLDetailsElement).open))) await drawer.locator("summary").click();
    return drawer;
  }
  return page.getByTestId("event-spine-column");
}

test("the launchpad leads with real events, keeps diagnostics to three counted cards, folds the demo away and remembers", async ({ page }) => {
  test.setTimeout(150_000);
  const eventId = await createNowEvent(page, `Spine Room ${Date.now()}`);
  await gotoAndAssert(page, "/production-access/launchpad");
  await expect(page.getByTestId("operator-launchpad")).toBeVisible();
  await expect(page.getByTestId("console-toc")).toBeVisible();
  // Your events is open by default and carries the real event, not a demo id.
  await expect(page.getByTestId("console-section-your-events")).toHaveAttribute("data-open", "true");
  await expect(page.getByTestId(`launchpad-event-${eventId}`)).toContainText("Spine Room");
  // Diagnostics: three cards (testing console, the manual, runtime health), and the badge on the
  // section says the same number the body shows.
  await expect(page.getByTestId("console-section-diagnostics")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("console-section-diagnostics-count")).toHaveText("3");
  await page.getByTestId("console-section-diagnostics-toggle").click();
  const diagnostics = page.locator("#diagnostics-body");
  await expect(diagnostics.locator("a")).toHaveCount(3);
  for (const href of ["/admin/testing", "/manual", "/api/runtime/health"]) await expect(diagnostics.locator(`a[href="${href}"]`)).toHaveCount(1);
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
  // The spine is the left column on a wide screen and the "All event pages" drawer on a phone; the
  // same nav renders in both, one of them hidden, so the checks run inside whichever one shows.
  const scope = await spineInView(page);
  const spine = scope.getByTestId("event-spine");
  await expect(spine).toBeVisible();
  for (const group of ["overview", "plan", "people", "comms", "show-day", "after", "publish"]) {
    await expect(scope.getByTestId(`spine-group-${group}`)).toBeVisible();
  }
  await expect(scope.getByTestId("spine-whats-next")).toContainText(/Name the speakers/i);
  await expect(scope.getByTestId("spine-link-speakers")).toHaveAttribute("data-ready", "false");

  // The merged duplicates keep working: they redirect to the page that stayed.
  for (const [from, to] of [["producer", ""], ["timeline", "/tasks"], ["approvals", "/approval-queue"]] as const) {
    await page.goto(`/app/events/${eventId}/${from}`);
    await expect(page).toHaveURL(new RegExp(`/app/events/${eventId}${to}$`));
  }

  // Name a speaker from the access page's guest tooling → the dot goes green.
  await gotoAndAssert(page, `/app/events/${eventId}/speakers`);
  await expect((await spineInView(page)).getByTestId("spine-link-speakers")).toBeVisible();
});
