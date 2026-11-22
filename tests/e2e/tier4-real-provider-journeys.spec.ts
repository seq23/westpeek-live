import { expect, test } from './fixtures';
import { loginAsMasterOperator } from './helpers/roleJourney';

const tier4Enabled = () => process.env.TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF === '1';
const eventId = () => process.env.TIER4_EVENT_ID || process.env.STREAMYARD_E2E_EVENT_ID || 'tier4-manual-event';
const stageId = () => process.env.TIER4_STAGE_ID || 'main-stage';

const providerPayload = () => ({
  eventId: eventId(),
  stageId: stageId(),
  roomId: `${eventId()}-${stageId()}`,
  roomType: 'main_stage',
  displayName: 'Tier 4 Operator',
  role: 'producer',
  videoRole: 'producer',
  zoomRole: 1,
  meetingNumber: process.env.TIER4_ZOOM_MEETING_NUMBER || '12345678901',
});

test.describe('Tier 4 real-provider user journeys', () => {
  test('private provider controls are denied to public users and available only through operator-scoped proof', async ({ page, request }) => {
    test.skip(!tier4Enabled(), 'Tier 4 real-provider user journeys require TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 and deployed real provider credentials.');

    const payload = providerPayload();
    for (const route of ['/api/video/livekit-ingress', '/api/video/daily-token', '/api/video/zoom-signature']) {
      const response = await request.post(route, { data: payload });
      expect([400, 401, 403, 409, 500, 502], `${route} should deny or fail safely for public callers`).toContain(response.status());
      const text = await response.text();
      expect(text).not.toMatch(/LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET|DAILY_API_KEY|ZOOM_MEETING_SDK_SECRET|SUPABASE_SERVICE_ROLE_KEY|stream[_\s-]*key|rtmps?:\/\//i);
    }

    await loginAsMasterOperator(page, `/admin/testing/${payload.eventId}`);
    await expect(page.locator('body')).toContainText(/LiveKit|StreamYard|Daily|Zoom|fallback|Testing Console/i);

    const authedRequest = page.context().request;
    const ingress = await authedRequest.post('/api/video/livekit-ingress', { data: { eventId: payload.eventId, stageId: payload.stageId } });
    expect([200, 409], 'master-operator-scoped LiveKit ingress should either provision or return provider-safe blocked state').toContain(ingress.status());
    const ingressText = await ingress.text();
    expect(ingressText).not.toMatch(/LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/i);

    const state = await authedRequest.get(`/api/video/stage-stream-state?eventId=${encodeURIComponent(payload.eventId)}&stageId=${encodeURIComponent(payload.stageId)}&view=operator`);
    expect([200, 409, 503]).toContain(state.status());
    expect(await state.text()).not.toMatch(/LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/i);
  });

  test('attendee stage never exposes StreamYard/LiveKit private provider material during Tier 4 proof', async ({ page }) => {
    test.skip(!tier4Enabled(), 'Tier 4 real-provider user journeys require TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1.');
    await page.goto(`/venue/${eventId()}/stage`);
    await expect(page.locator('body')).toContainText(/Stage|Live|Stream|Daily|fallback|pre-stream|West Peek/i);
    await expect(page.locator('body')).not.toContainText(/Stream Key|RTMP URL|LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY|DAILY_API_KEY|ZOOM_MEETING_SDK_SECRET/i);
  });
});
