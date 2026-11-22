import { expect, test, type Page } from "@playwright/test";
import { gotoAndAssert } from "./helpers/assertNoAppError";
import { isDeployedBrowserRun, loginAsOperator } from "./helpers/roleJourney";

/**
 * Two things a phone user hits before anything else: can they tap it, and can they read it.
 *  - Every pill (gate exits, chips, CTAs) and the file picker is at least 44px tall (it was 22-34px).
 *  - With the phone in dark mode the app is dark (warm near-black, cream ink), and the West Peek mark
 *    flips with the surface instead of vanishing on it. Before 22 Nov 2026 dark mode showed the light
 *    design.
 * Local file-store run only (the file picker needs an event to be created).
 */
test.skip(isDeployedBrowserRun(), "local runtime-store journey");
test.use({ viewport: { width: 390, height: 844 } });

const TAP_MIN = 44;

async function shortPills(page: Page) {
  return page.locator("a.rounded-full, button.rounded-full").evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ text: (el.textContent || "").trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((p) => p.h < 44),
  );
}

function luminanceOf(color: string) {
  const [r, g, b] = (color.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number).map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function groundAndInk(page: Page) {
  return page.evaluate(() => ({
    ground: getComputedStyle(document.documentElement).backgroundColor,
    ink: getComputedStyle(document.body).color,
    scheme: getComputedStyle(document.documentElement).colorScheme,
  }));
}

test("gate exits and every pill on the gate are 44px tall at 390", async ({ page }) => {
  await gotoAndAssert(page, "/production-access/crew");
  const exits = page.getByTestId("gate-exit").locator("a");
  expect(await exits.count()).toBeGreaterThanOrEqual(3);
  for (const box of await exits.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(TAP_MIN);
  expect(await shortPills(page)).toEqual([]);
});

test("the file picker is 44px tall at 390", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsOperator(page, "/app/events/new");
  await page.getByTestId("when-now").check();
  await page.locator('[name="name"]').fill(`Tap Room ${Date.now()}`);
  await page.getByTestId("create-event-submit").click();
  await expect(page).toHaveURL(/\/venue\/[a-z0-9-]+\/lobby\?created=1/);
  const eventId = new URL(page.url()).pathname.split("/")[2];
  await gotoAndAssert(page, `/app/events/${eventId}/assets`);
  const picker = page.getByTestId("asset-file-input");
  await expect(picker).toBeVisible();
  expect((await picker.boundingBox())!.height).toBeGreaterThanOrEqual(TAP_MIN);
  expect(await shortPills(page)).toEqual([]);
});

test("dark mode is dark, light mode is light, and the mark flips with the surface", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await gotoAndAssert(page, "/production-access/crew");
  const dark = await groundAndInk(page);
  expect(dark.scheme).toBe("dark");
  expect(luminanceOf(dark.ground)).toBeLessThan(0.03);
  expect(luminanceOf(dark.ink)).toBeGreaterThan(0.7);

  await gotoAndAssert(page, "/join");
  const mark = page.getByTestId("west-peek-mark").first();
  await expect(mark).toBeVisible();
  await expect.poll(() => mark.evaluate((img) => (img as HTMLImageElement).currentSrc)).toMatch(/wp-mark-white/);

  await page.emulateMedia({ colorScheme: "light" });
  await gotoAndAssert(page, "/production-access/crew");
  const light = await groundAndInk(page);
  expect(light.scheme).toBe("light");
  expect(luminanceOf(light.ground)).toBeGreaterThan(0.85);
  expect(luminanceOf(light.ink)).toBeLessThan(0.01);
  await gotoAndAssert(page, "/join");
  await expect.poll(() => page.getByTestId("west-peek-mark").first().evaluate((img) => (img as HTMLImageElement).currentSrc)).toMatch(/wp-mark-black/);
});
