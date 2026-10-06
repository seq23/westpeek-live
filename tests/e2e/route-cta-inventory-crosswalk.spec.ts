import { expect, test } from '@playwright/test';
import { expectVisibleRoute, expectLinksStayFirstParty, loginAsOperator, openConsoleSection } from './helpers/roleJourney';

test.setTimeout(180_000);

const publicRoutes = [
  '/', '/start', '/start/create-event', '/request-event', '/how-it-works', '/pricing', '/operator-packet', '/join', '/events/demo', '/events/demo/register', '/events/demo/agenda', '/events/demo/speakers', '/events/demo/sponsors', '/privacy', '/terms'
];
const venueRoutes = ['/venue/demo/lobby', '/venue/demo/stage', '/venue/demo/sessions', '/venue/demo/breakouts', '/venue/demo/networking', '/venue/demo/expo', '/venue/demo/people', '/venue/demo/replay', '/venue/demo/help'];
const protectedRoutes = ['/production-access', '/production-access/operator', '/production-access/crew', '/production-access/special-guest'];

test('public, venue, access, and operator CTA crosswalk routes render with first-party links', async ({ page }) => {
  for (const path of [...publicRoutes, ...venueRoutes, ...protectedRoutes]) {
    await expectVisibleRoute(page, { path, label: path, anyOf: ['West Peek', 'Event', 'production', 'Register', 'Venue', 'access', 'privacy', 'terms'] });
    await expectLinksStayFirstParty(page);
  }

  await loginAsOperator(page, '/production-access/launchpad');
  // The launchpad folds its cards into sections (16 Sep 2026): each CTA is one section-open away,
  // and every card stays first-party.
  await expect(page.getByTestId('operator-launchpad').getByRole('link', { name: 'New event', exact: true }).first()).toHaveAttribute('href', '/app/events/new');
  for (const [section, label, href] of [
    // The cards that exist with or without events on the books (the per-event cards are proven by
    // operator-crew-instruction-flow and operator-launchpad-common-sense, which make their own).
    ['demo', 'Demo venue', '/venue/demo/lobby'],
    ['set-up', 'New event', '/app/events/new'],
    ['diagnostics', 'Testing console', '/admin/testing'],
    ['people-data', 'People across events', '/app/people'],
  ] as const) {
    const body = await openConsoleSection(page, section);
    await expect(body.getByRole('link', { name: new RegExp(`^${label}`) }).first(), `${label} CTA should exist`).toHaveAttribute('href', href);
  }
  await expectLinksStayFirstParty(page);
});
