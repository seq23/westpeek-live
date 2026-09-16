import { expect, test } from '@playwright/test';
import { gotoAndAssert } from './helpers/assertNoAppError';
import { loginAsOperator } from './helpers/roleJourney';

async function createEvent(page: any, name: string) {
  await loginAsOperator(page, '/app/events/new');
  await page.getByTestId('when-later').check();
  await page.getByLabel(/^Event name/i).fill(name);
  await page.getByLabel(/New client name/i).fill('West Peek Productions');
  await page.getByLabel(/^Type/i).selectOption('virtual_summit');
  await page.getByTestId('create-event-submit').click();
  await expect(page).toHaveURL(/\/app\/events\/[a-z0-9-]+\?created=1/);
  const slug = new URL(page.url()).pathname.split('/')[3];
  // A draft is not public; publish it so the public event page resolves.
  await page.getByTestId('publish-event').click();
  await expect(page).toHaveURL(new RegExp(`/app/events/${slug}/publish\\?updated=registration_open`));
  await gotoAndAssert(page, `/app/events/${slug}/access`);
  const codes = {
    slug,
    speaker: (await page.getByTestId('generated-speaker-code').innerText()).trim(),
    sponsor: (await page.getByTestId('generated-sponsor-code').innerText()).trim(),
  };
  return codes;
}

test('cross-event: two newly-created events keep routes, codes, and scoped portals isolated', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const suffix = Date.now().toString(36);
  const codesA = await createEvent(page, `Scope Isolation A ${suffix}`);
  const codesB = await createEvent(page, `Scope Isolation B ${suffix}`);
  const eventA = codesA.slug;
  const eventB = codesB.slug;
  expect(eventA).not.toEqual(eventB);
  expect(codesA.speaker).not.toEqual(codesB.speaker);
  expect(codesA.sponsor).not.toEqual(codesB.sponsor);

  await gotoAndAssert(page, `/events/${eventA}`);
  await expect(page.locator('body')).toContainText(`Scope Isolation A ${suffix}`);
  await expect(page.locator('body')).not.toContainText(`Scope Isolation B ${suffix}`);

  await gotoAndAssert(page, `/events/${eventB}`);
  await expect(page.locator('body')).toContainText(`Scope Isolation B ${suffix}`);
  await expect(page.locator('body')).not.toContainText(`Scope Isolation A ${suffix}`);

  await gotoAndAssert(page, '/production-access/special-guest');
  await page.getByLabel(/event code/i).fill(eventB);
  await page.getByLabel(/special guest password/i).fill(codesA.speaker);
  await page.getByRole('button', { name: /continue to assigned portal/i }).click();
  await expect(page.locator('body')).toContainText(/not valid|special guest|code/i);
  await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error|__next_error__|digest/i);
  await context.close();
});
