import { createHmac } from 'node:crypto';
import { expect, test } from './fixtures';
import { day1Default } from './helpers/day1AccessDefaults';

function sign(body: string) {
  const secret = process.env.LIVEKIT_WEBHOOK_SECRET || day1Default('LIVEKIT_WEBHOOK_SECRET', 'local-playwright-livekit-webhook-secret-1234567890');
  return createHmac('sha256', secret).update(body).digest('hex');
}

test.describe('LiveKit webhook security and provider edge cases', () => {
  test('rejects unsigned and invalid-signature webhooks closed', async ({ request }) => {
    const body = JSON.stringify({ event: 'ingress_started', eventId: 'security-e2e', stageId: 'main-stage', ingressInfo: { roomName: 'security-e2e-main-stage' } });
    const unsigned = await request.post('/api/video/livekit-webhook', { data: Buffer.from(body), headers: { 'content-type': 'application/json' } });
    expect(unsigned.status()).toBe(401);
    await expect(async () => expect(await unsigned.text()).not.toContain('LIVEKIT_API_SECRET')).toPass();

    const invalid = await request.post('/api/video/livekit-webhook', { data: Buffer.from(body), headers: { 'content-type': 'application/json', 'x-livekit-signature': 'bad-signature' } });
    expect(invalid.status()).toBe(401);
  });

  test('signed malformed JSON fails controlled and signed unknown event is ignored safely', async ({ request }) => {
    const malformed = '{not-json';
    const malformedResponse = await request.post('/api/video/livekit-webhook', { data: Buffer.from(malformed), headers: { 'content-type': 'application/json', 'x-livekit-signature': sign(malformed) } });
    expect(malformedResponse.status()).toBe(400);
    expect(await malformedResponse.text()).toContain('Invalid webhook JSON');

    const unknownBody = JSON.stringify({ event: 'participant_metadata_changed', eventId: 'security-e2e', stageId: 'main-stage', room: { name: 'security-e2e-main-stage' } });
    const unknown = await request.post('/api/video/livekit-webhook', { data: Buffer.from(unknownBody), headers: { 'content-type': 'application/json', 'x-livekit-signature': sign(unknownBody) } });
    expect(unknown.ok()).toBeTruthy();
    const json = await unknown.json();
    expect(json.ignored).toBe(true);
  });

  test('repeated signed ingress_ended does not expose secrets or misclassify provider failure planes', async ({ request }) => {
    const startBody = JSON.stringify({ event: 'ingress_started', eventId: 'replay-e2e', stageId: 'main-stage', ingressInfo: { roomName: 'replay-e2e-main-stage' } });
    const endBody = JSON.stringify({ event: 'ingress_ended', eventId: 'replay-e2e', stageId: 'main-stage', ingressInfo: { roomName: 'replay-e2e-main-stage' } });
    const start = await request.post('/api/video/livekit-webhook', { data: Buffer.from(startBody), headers: { 'content-type': 'application/json', 'x-livekit-signature': sign(startBody) } });
    expect(start.ok()).toBeTruthy();
    const firstEnd = await request.post('/api/video/livekit-webhook', { data: Buffer.from(endBody), headers: { 'content-type': 'application/json', 'x-livekit-signature': sign(endBody) } });
    const secondEnd = await request.post('/api/video/livekit-webhook', { data: Buffer.from(endBody), headers: { 'content-type': 'application/json', 'x-livekit-signature': sign(endBody) } });
    expect(firstEnd.ok()).toBeTruthy();
    expect(secondEnd.ok()).toBeTruthy();
    const state = (await secondEnd.json()).state;
    expect(String(state.failurePlane)).toMatch(/STREAMYARD_FEED|NONE/);
    expect(JSON.stringify(state)).not.toMatch(/streamKey|livekitStreamKey|api_secret|webhook_secret/i);
  });
});
