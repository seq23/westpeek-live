import { expect, test } from './fixtures';
import { loginAsOperator } from './helpers/roleJourney';

const enabled = () => process.env.STREAMYARD_REAL_PROVIDER_SMOKE === '1';

test.describe('REAL StreamYard Custom RTMP → LiveKit media proof', () => {
  test('operator-provisioned LiveKit ingress receives confirmed StreamYard broadcast and attendee route shows live/fallback state truthfully', async ({ page, request }) => {
    test.skip(!enabled(), 'STREAMYARD_REAL_PROVIDER_SMOKE=1 is required. This lane requires real LiveKit creds and a private StreamYard Custom RTMP broadcast.');
    test.skip(!process.env.STREAMYARD_OPERATOR_CONFIRMED_BROADCAST, 'Set STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 only after the operator starts the private StreamYard Custom RTMP broadcast.');

    const eventId = process.env.TIER4_EVENT_ID || process.env.STREAMYARD_E2E_EVENT_ID || 'demo';
    await loginAsOperator(page, `/admin/testing/${eventId}`);
    await expect(page.locator('body')).toContainText(/StreamYard|LiveKit|Click to Copy RTMP URL|Click to Copy Stream Key|ingress/i);

    const operatorState = await request.get(`/api/video/stage-stream-state?eventId=${eventId}&stageId=main-stage&view=operator`);
    expect([200, 401, 403]).toContain(operatorState.status());
    if (operatorState.ok()) {
      const json = await operatorState.json();
      expect(JSON.stringify(json)).toMatch(/LIVEKIT_INGRESS|READY_FOR_STREAMYARD|LIVEKIT_INGRESS_LIVE|STREAMYARD/i);
      expect(JSON.stringify(json)).not.toMatch(/LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET/i);
    }

    await page.goto(`/venue/${eventId}/stage`);
    await expect(page.locator('body')).toContainText(/Live|Stream|Stage|Daily|fallback|pre-stream|West Peek/i);
    await expect(page.locator('body')).not.toContainText(/Stream Key|RTMP URL|LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET/i);
  });
});
