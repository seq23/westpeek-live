import { expect, test } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { requiredDay1Default } from "./helpers/day1AccessDefaults";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * The manual inside the app, and the way out of a gate. A gate is reached by redirect, so the
 * browser's back button lands on the page that redirected and bounces straight back — every gate
 * now carries its own exits. And the manual is readable by the people running the show, with its
 * screenshots, carrying no codes.
 * Local file-store run only.
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");

test("every gate offers a way out that is not the back button, and keeps where you were going", async ({ page }) => {
  test.setTimeout(120_000);
  // A protected page without a session sends you to a gate — with ?next= kept.
  await page.goto("/app/people");
  await expect(page).toHaveURL(/\/production-access\/operator\?next=%2Fapp%2Fpeople/);
  const exit = page.getByTestId("gate-exit");
  await expect(exit).toBeVisible();
  await expect(page.getByTestId("gate-exit-next")).toHaveAttribute("href", "/app/people");
  await expect(page.getByTestId("gate-exit-console")).toHaveAttribute("href", "/app/owner");
  await expect(page.getByTestId("gate-exit-doors")).toHaveAttribute("href", "/production-access");
  // "All the doors" is a real page, and it is not a gate: the exit works.
  await page.getByTestId("gate-exit-doors").click();
  await expect(page).toHaveURL(/\/production-access$/);

  // The crew and special-guest gates carry the same exits; a gate never offers itself as "back".
  await gotoAndAssert(page, "/production-access/crew");
  await expect(page.getByTestId("gate-exit")).toBeVisible();
  await expect(page.getByTestId("gate-exit-next")).toHaveCount(0);
  await gotoAndAssert(page, "/production-access/special-guest?next=/production-access/crew");
  await expect(page.getByTestId("gate-exit-next")).toHaveCount(0);
});

test("the manual renders in the app for an operator, with its screenshots and no codes", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsOperator(page, "/manual");
  await expect(page).toHaveURL(/\/manual$/);
  const body = page.getByTestId("manual-body");
  await expect(body).toContainText(/West Peek Live/i);
  await expect(page.getByTestId("manual-toc")).toBeVisible();
  // The screenshots come from public/, so they actually load.
  const firstImage = body.locator("img").first();
  await expect(firstImage).toHaveAttribute("src", /^\/manual\/images\//);
  expect(await firstImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(10);
  // No code values, ever — only the documented placeholders.
  const text = await body.innerText();
  expect(text).not.toMatch(/\bSPK-[A-Z0-9]{6}\b/);
  expect(text).not.toContain(requiredDay1Default("CREW_ACCESS_PASSWORD"));
  expect(text).not.toContain(requiredDay1Default("OPERATOR_LAUNCHPAD_PASSWORD"));
});

test("a fresh browser cannot read the manual", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/manual");
  await expect(page).toHaveURL(/\/production-access\/operator/);
  await expect(page.getByTestId("gate-exit")).toBeVisible();
  await context.close();
});
