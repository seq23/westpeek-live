import { expect, test } from './fixtures';

const explicitBaseUrl = () => process.env.POSTDEPLOY_BASE_URL || process.env.SMOKE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
const postdeploy = () => {
  const baseUrl = explicitBaseUrl();
  return /^https?:\/\//.test(baseUrl) && !/localhost|127\.0\.0\.1/.test(baseUrl);
};

test.describe('postdeploy role/provider critical proof', () => {
  test('deployed public, access, venue, and provider routes fail safely or render usefully', async ({ page, request }) => {
    test.skip(!postdeploy(), 'Postdeploy proof requires PLAYWRIGHT_DEPLOYED=1 and deployed base URL.');
    for (const route of ['/', '/events/demo', '/events/demo/register', '/venue/demo/lobby', '/venue/demo/stage', '/production-access']) {
      await page.goto(route);
      await expect(page.locator('body')).toContainText(/West Peek|Event|Venue|Register|access|production/i);
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error|__next_error__|digest|LIVEKIT_API_SECRET|SUPABASE_SERVICE_ROLE_KEY/i);
    }

    for (const endpoint of ['/api/video/stage-stream-state?eventId=demo&stageId=main-stage', '/api/video/livekit-token', '/api/video/daily-stage-token']) {
      const response = await request.get(endpoint);
      expect([200, 400, 401, 403, 405, 409, 503]).toContain(response.status());
      expect(await response.text()).not.toMatch(/LIVEKIT_API_SECRET|LIVEKIT_API_KEY|DAILY_API_KEY|SUPABASE_SERVICE_ROLE_KEY|Internal Server Error|digest/i);
    }
  });
});
