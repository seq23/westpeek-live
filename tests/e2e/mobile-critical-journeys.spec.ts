import { expect, test } from '@playwright/test';
import { gotoAndAssert } from './helpers/assertNoAppError';
import { grantOperatorAccess } from './helpers/roleJourney';

test.describe('mobile critical journeys', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile public discovery, registration, and venue surfaces are usable', async ({ page }) => {
    for (const route of ['/', '/events/demo', '/events/demo/register', '/venue/demo/lobby', '/venue/demo/stage', '/venue/demo/help']) {
      await gotoAndAssert(page, route);
      await expect(page.locator('body')).toContainText(/West Peek|Event|Register|Venue|Lobby|Stage|Help/i);
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error|__next_error__|digest/i);
    }
    await gotoAndAssert(page, '/events/demo/register');
    await expect(page.getByLabel(/^Name/i)).toBeVisible();
    await expect(page.getByTestId("registration-form").getByLabel(/^Email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /submit registration/i })).toBeVisible();
  });

  test('mobile operator emergency surfaces remain reachable', async ({ page }) => {
    await grantOperatorAccess(page);
    await gotoAndAssert(page, '/production-access/launchpad');
    await expect(page.locator('body')).toContainText(/Operator Launchpad|Create Event|Testing Console|Video Health|Run of Show/i);
    await page.getByRole('link', { name: /Testing Console/i }).first().click();
    await expect(page.locator('body')).toContainText(/StreamYard|LiveKit|fallback|ingress/i);
  });
});
