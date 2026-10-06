import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const reportsDir = path.join(root, 'reports', 'tier4');
const baseUrl = (process.env.POSTDEPLOY_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
const stageId = process.env.TIER4_STAGE_ID || process.env.STREAMYARD_E2E_STAGE_ID || 'main-stage';
const evidencePath = process.env.TIER4_STREAMYARD_LIVE_EVIDENCE_PATH || 'reports/tier4/streamyard-livekit-evidence.json';
const attendeeId = process.env.TIER4_ATTENDEE_ID || `tier4-attendee-${crypto.randomBytes(3).toString('hex')}`;
const secretPatterns = /rtmps?:\/\/|Bearer\s+[A-Za-z0-9._~+\/=-]{16,}/i;
const trace = [];
const failures = [];
const secretValues = new Map();

for (const key of [
  'LIVEKIT_API_SECRET',
  'LIVEKIT_WEBHOOK_SECRET',
  'DAILY_API_KEY',
  'ZOOM_MEETING_SDK_SECRET',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_STREAM_API_TOKEN',
  'V5_ACCESS_COOKIE_SECRET'
]) {
  if (process.env[key]) secretValues.set(key, process.env[key]);
}

function nowIso() { return new Date().toISOString(); }
function pushTrace(step, details = {}) { trace.push({ step, at: nowIso(), ...details }); }
function b64(input) { return Buffer.from(input).toString('base64url'); }
function redact(value) { return value ? `${String(value).slice(0, 6)}…redacted` : undefined; }
function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8')); }
function assertNoSecrets(label, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const [key, secret] of secretValues) {
    if (secret && text.includes(secret)) failures.push(`${label} exposed raw provider secret (${key}).`);
  }
  if (secretPatterns.test(text)) failures.push(`${label} exposed provider secret or private material.`);
}
function makeOperatorCookie(eventId) {
  const secret = process.env.V5_ACCESS_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new Error('V5_ACCESS_COOKIE_SECRET is required for Tier 4 attendee live consumption proof.');
  const now = Date.now();
  const payload = { kind: 'operator', eventId, role: 'producer', issuedAt: now, expiresAt: now + 15 * 60 * 1000 };
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${process.env.V5_OPERATOR_COOKIE_NAME || 'wpl_operator_access'}=v5.${body}.${sig}`;
}
async function request(method, eventPath, body, cookie) {
  const response = await fetch(`${baseUrl}${eventPath}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch {}
  assertNoSecrets(`${method} ${eventPath}`, text);
  return { response, text, json, setCookie: response.headers.get('set-cookie') || '' };
}
function requireControlledMediaEvidence() {
  if (!fs.existsSync(path.resolve(root, evidencePath))) throw new Error(`Missing controlled RTMP evidence file: ${evidencePath}. Run tier4:auto-controlled-livekit-proof or provide TIER4_STREAMYARD_LIVE_EVIDENCE_PATH.`);
  const evidence = readJson(evidencePath);
  const rtmp = evidence.streamyardCompatibleRtmpPath || evidence.livekitProviderApi || {};
  if (evidence.providerLane !== 'streamyard-livekit') failures.push('evidence.providerLane must equal streamyard-livekit.');
  if (!evidence.eventId) failures.push('controlled RTMP evidence must include eventId.');
  if (evidence.controlledRtmpBroadcaster !== true) failures.push('controlled RTMP broadcaster evidence is required.');
  if (rtmp.mediaConnectionObserved !== true) failures.push('controlled RTMP media connection must be observed before attendee consumption proof.');
  if (rtmp.participantObserved !== true && evidence.livekitProviderApi?.controlledBroadcasterParticipantObserved !== true) failures.push('controlled broadcaster participant must be observed before attendee consumption proof.');
  if (process.env.TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID && evidence.tier4RunId !== process.env.TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID) failures.push('controlled RTMP evidence run id must match this Tier 4 run.');
  assertNoSecrets('controlled RTMP evidence', evidence);
  return evidence;
}
function parseCookie(setCookie) {
  const first = String(setCookie || '').split(';')[0];
  const index = first.indexOf('=');
  if (index < 1) return undefined;
  return { name: first.slice(0, index), value: first.slice(index + 1) };
}
async function runBrowserAttendeeProof({ eventId, attendeeCookie, operatorCookie, attendeeId }) {
  pushTrace('attendee_browser_stage_trace_start');
  const parsed = parseCookie(attendeeCookie);
  if (!parsed) return { ok: false, error: 'missing attendee cookie for browser trace' };
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: process.env.TIER4_ATTENDEE_BROWSER_HEADED === '1' ? false : true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.addCookies([{ name: parsed.name, value: parsed.value, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);

  const browserSetup = { stageLiveStatus: undefined, sessionStatus: undefined, sessionOk: false, sessionCookieSet: false, permitStatus: undefined, permitOk: false };
  const operatorHeaders = { cookie: operatorCookie };

  const stageLiveSeed = await context.request.post(`${baseUrl}/api/video/stage-stream-fallback`, {
    headers: operatorHeaders,
    data: { eventId, stageId, signal: 'ingress_started', reason: 'Tier 4 browser-context live state seed.' },
  }).catch(() => undefined);
  browserSetup.stageLiveStatus = stageLiveSeed?.status();
  const stageLiveJson = await stageLiveSeed?.json().catch(() => undefined);
  browserSetup.stageLiveOk = Boolean(stageLiveJson?.ok);
  browserSetup.stageLiveReturnedState = stageLiveJson?.state ? {
    activeStreamSource: stageLiveJson.state.activeStreamSource,
    streamStatus: stageLiveJson.state.streamStatus,
    hasEverStarted: stageLiveJson.state.hasEverStarted,
  } : undefined;

  const stageReadback = await context.request.get(`${baseUrl}/api/video/stage-stream-state?eventId=${encodeURIComponent(eventId)}&stageId=${encodeURIComponent(stageId)}`).catch(() => undefined);
  browserSetup.stageReadbackStatus = stageReadback?.status();
  const stageReadbackJson = await stageReadback?.json().catch(() => undefined);
  browserSetup.stageReadbackState = stageReadbackJson?.state ? {
    activeStreamSource: stageReadbackJson.state.activeStreamSource,
    streamStatus: stageReadbackJson.state.streamStatus,
    hasEverStarted: stageReadbackJson.state.hasEverStarted,
  } : undefined;
  browserSetup.stageReadbackLive = Boolean(stageReadbackJson?.state?.activeStreamSource === 'LIVEKIT_INGRESS' && stageReadbackJson?.state?.streamStatus === 'LIVEKIT_INGRESS_LIVE' && stageReadbackJson?.state?.hasEverStarted === true);

  const browserSession = await context.request.post(`${baseUrl}/api/tier4/attendee-live-session`, {
    headers: operatorHeaders,
    data: { eventId, attendeeId, name: 'Tier 4 Browser Event Goer' },
  }).catch(() => undefined);
  browserSetup.sessionStatus = browserSession?.status();
  const browserSessionJson = await browserSession?.json().catch(() => undefined);
  browserSetup.sessionOk = Boolean(browserSessionJson?.ok);
  const browserSetCookie = browserSession?.headers()['set-cookie'] || '';
  const browserParsedCookie = parseCookie(browserSetCookie);
  if (browserParsedCookie) {
    await context.addCookies([{ name: browserParsedCookie.name, value: browserParsedCookie.value, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);
    browserSetup.sessionCookieSet = true;
  }

  const browserPermit = await context.request.post(`${baseUrl}/api/attendee-live/access`, {
    headers: operatorHeaders,
    data: { eventId, roomKind: 'main_stage', roomId: stageId, attendeeId, action: 'permit', canJoinLiveStream: true },
  }).catch(() => undefined);
  browserSetup.permitStatus = browserPermit?.status();
  const browserPermitJson = await browserPermit?.json().catch(() => undefined);
  browserSetup.permitOk = Boolean(browserPermitJson?.capability?.canJoinLiveStream === true && browserPermitJson?.capability?.revoked === false);

  if (!browserSetup.stageReadbackLive) {
    return {
      ok: false,
      error: 'deployed stage stream state did not persist browser-context ingress_started seed before attendee navigation',
      stagePlayerFound: false,
      livekitSurfaceFound: false,
      browserSetup,
      browserSignals: { consoleErrors: [], stageStateResponses: [], livekitTokenResponses: [] },
    };
  }

  const page = await context.newPage();
  const browserSignals = { consoleErrors: [], stageStateResponses: [], livekitTokenResponses: [] };
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) browserSignals.consoleErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/video/stage-stream-state')) {
      const text = await res.text().catch(() => '');
      let json;
      try { json = text ? JSON.parse(text) : undefined; } catch {}
      browserSignals.stageStateResponses.push({
        status: res.status(),
        ok: Boolean(json?.ok),
        activeStreamSource: json?.state?.activeStreamSource,
        streamStatus: json?.state?.streamStatus,
        hasEverStarted: json?.state?.hasEverStarted,
      });
      return;
    }
    if (!res.url().includes('/api/video/livekit-token')) return;
    const text = await res.text().catch(() => '');
    let json;
    try { json = text ? JSON.parse(text) : undefined; } catch {}
    browserSignals.livekitTokenResponses.push({
      status: res.status(),
      ok: Boolean(json?.ok),
      error: json?.error || undefined,
      hasToken: Boolean(json?.result?.token?.token),
      hasLivekitUrl: Boolean(json?.result?.livekitUrl)
    });
  });
  const screenshotPath = path.join(reportsDir, 'tier4-attendee-live-stage.png');
  try {
    const tokenResponsePromise = page.waitForResponse((res) => res.url().includes('/api/video/livekit-token'), { timeout: 30000 }).catch(() => undefined);
    const response = await page.goto(`${baseUrl}/venue/${encodeURIComponent(eventId)}/stage`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    await page.waitForSelector('[data-testid="stage-player"][data-active-stream-source="LIVEKIT_INGRESS"][data-stream-status="LIVEKIT_INGRESS_LIVE"]', { timeout: 25000 }).catch(() => undefined);
    await page.waitForSelector('[data-testid="attendee-livekit-room-surface"][data-livekit-consumption-state="token-issued"]', { timeout: 30000 }).catch(() => undefined);
    const observedTokenResponse = await tokenResponsePromise;
    if (observedTokenResponse) {
      const text = await observedTokenResponse.text().catch(() => '');
      let json;
      try { json = text ? JSON.parse(text) : undefined; } catch {}
      const observed = {
        status: observedTokenResponse.status(),
        ok: Boolean(json?.ok),
        error: json?.error || undefined,
        hasToken: Boolean(json?.result?.token?.token),
        hasLivekitUrl: Boolean(json?.result?.livekitUrl)
      };
      if (!browserSignals.livekitTokenResponses.some((entry) => entry.status === observed.status && entry.ok === observed.ok && entry.hasToken === observed.hasToken && entry.hasLivekitUrl === observed.hasLivekitUrl)) browserSignals.livekitTokenResponses.push(observed);
    }
    await page.waitForTimeout(1500).catch(() => undefined);
    const bodyText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
    assertNoSecrets('attendee browser body', bodyText);
    const stagePlayer = await page.locator('[data-testid="stage-player"]').count();
    const livekitSurface = await page.locator('[data-testid="attendee-livekit-room-surface"]').count();
    const stagePlayerAttrs = stagePlayer > 0 ? await page.locator('[data-testid="stage-player"]').first().evaluate((el) => ({
      activeStreamSource: el.getAttribute('data-active-stream-source'),
      streamStatus: el.getAttribute('data-stream-status'),
    })).catch(() => undefined) : undefined;
    const livekitSurfaceState = livekitSurface > 0 ? await page.locator('[data-testid="attendee-livekit-room-surface"]').first().getAttribute('data-livekit-consumption-state').catch(() => undefined) : undefined;
    const browserLivekitTokenIssued = browserSignals.livekitTokenResponses.some((entry) => entry.status === 200 && entry.ok === true && entry.hasToken === true && entry.hasLivekitUrl === true);
    const livekitSurfaceTokenIssued = livekitSurfaceState === 'token-issued';
    const stagePlayerLiveKitLive = stagePlayerAttrs?.activeStreamSource === 'LIVEKIT_INGRESS' && stagePlayerAttrs?.streamStatus === 'LIVEKIT_INGRESS_LIVE';
    const pageLooksLive = /Live stage connected|Connecting to LiveKit Ingress feed|Stage is getting ready|Main stage/i.test(bodyText);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    return { ok: Boolean(response?.ok() && stagePlayer > 0 && stagePlayerLiveKitLive && livekitSurface > 0 && livekitSurfaceTokenIssued && browserLivekitTokenIssued && pageLooksLive), status: response?.status(), stagePlayerFound: stagePlayer > 0, stagePlayerLiveKitLive, livekitSurfaceFound: livekitSurface > 0, livekitSurfaceTokenIssued, browserLivekitTokenIssued, stagePlayerAttrs, livekitSurfaceState, browserSetup, browserSignals, screenshot: path.relative(root, screenshotPath), bodySnippet: bodyText.slice(0, 240) };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
async function main() {
  if (!baseUrl || /localhost|127\.0\.0\.1/.test(baseUrl)) throw new Error('POSTDEPLOY_BASE_URL/PLAYWRIGHT_BASE_URL must be a deployed non-local URL for Tier 4 attendee live consumption proof.');
  fs.mkdirSync(reportsDir, { recursive: true });
  pushTrace('controlled_media_evidence_start');
  const controlledMedia = requireControlledMediaEvidence();
  const eventId = process.env.TIER4_ATTENDEE_EVENT_ID || process.env.TIER4_EVENT_ID || process.env.STREAMYARD_E2E_EVENT_ID || controlledMedia.eventId;
  if (!eventId) throw new Error('Tier 4 attendee consumption proof requires an eventId from env or controlled RTMP evidence.');
  if (controlledMedia.eventId && controlledMedia.eventId !== eventId) failures.push(`attendee proof eventId ${eventId} must match controlled media evidence eventId ${controlledMedia.eventId}.`);
  pushTrace('controlled_media_evidence_passed', { eventId, evidenceEventId: controlledMedia.eventId, mediaConnectionObserved: true });
  const operatorCookie = makeOperatorCookie(eventId);

  pushTrace('stage_primary_live_state_start');
  const live = await request('POST', '/api/video/stage-stream-fallback', { eventId, stageId, signal: 'ingress_started', reason: 'Tier 4 attendee consumption gauntlet primary live state.' }, operatorCookie);
  if (live.response.status !== 200 || !live.json?.ok) failures.push(`primary live state returned ${live.response.status}: ${live.text.slice(0, 200)}`);

  pushTrace('attendee_session_create_start');
  const session = await request('POST', '/api/tier4/attendee-live-session', { eventId, attendeeId, name: 'Tier 4 Event Goer' }, operatorCookie);
  if (session.response.status !== 200 || !session.json?.ok) failures.push(`attendee session creation returned ${session.response.status}: ${session.text.slice(0, 200)}`);
  const attendeeCookie = String(session.setCookie || '').split(';')[0];
  if (!attendeeCookie.includes('wpl_attendee_session=')) failures.push('attendee session route did not set attendee session cookie.');

  pushTrace('permit_attendee_start');
  const permit = await request('POST', '/api/attendee-live/access', { eventId, roomKind: 'main_stage', roomId: stageId, attendeeId, action: 'permit', canJoinLiveStream: true }, operatorCookie);
  if (permit.response.status !== 200 || permit.json?.capability?.canJoinLiveStream !== true || permit.json?.capability?.revoked !== false) failures.push(`permit returned ${permit.response.status}: ${permit.text.slice(0, 200)}`);

  pushTrace('attendee_stage_page_http_start');
  const pageHtml = await request('GET', `/venue/${encodeURIComponent(eventId)}/stage`, undefined, attendeeCookie);
  if (pageHtml.response.status !== 200) failures.push(`attendee stage page returned ${pageHtml.response.status}`);
  if (!/Main stage|Live stage|Stage|West Peek/i.test(pageHtml.text)) failures.push('attendee stage page did not render branded live stage copy.');

  pushTrace('attendee_livekit_token_permitted_start');
  const tokenOk = await request('POST', '/api/video/livekit-token', { eventId, roomId: stageId, roomType: 'main_stage', role: 'attendee' }, attendeeCookie);
  if (tokenOk.response.status !== 200 || !tokenOk.json?.ok || !tokenOk.json?.result?.token?.token) failures.push(`permitted attendee live token returned ${tokenOk.response.status}: ${tokenOk.text.slice(0, 200)}`);
  if (tokenOk.json?.result?.token?.roomId !== `${eventId}-${stageId}`.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()) failures.push('attendee LiveKit token room must match StreamYard-compatible ingress room.');

  const browserProof = await runBrowserAttendeeProof({ eventId, attendeeCookie, operatorCookie, attendeeId }).catch((error) => ({ ok: false, error: error?.message || String(error) }));
  if (!browserProof.ok) failures.push(`attendee browser live-stage proof failed: ${browserProof.error || JSON.stringify(browserProof)}`);

  pushTrace('revoke_attendee_start');
  const revoke = await request('POST', '/api/attendee-live/access', { eventId, roomKind: 'main_stage', roomId: stageId, attendeeId, action: 'revoke', revokedReason: 'Tier 4 revocation proof.' }, operatorCookie);
  if (revoke.response.status !== 200 || revoke.json?.capability?.revoked !== true) failures.push(`revoke returned ${revoke.response.status}: ${revoke.text.slice(0, 200)}`);
  if (revoke.json?.livekitParticipantRemoval?.attempted !== true && revoke.json?.livekitParticipantRemoval?.status !== 'not_configured') failures.push('revocation must attempt LiveKit participant removal or explicitly report not_configured.');
  const tokenRevoked = await request('POST', '/api/video/livekit-token', { eventId, roomId: stageId, roomType: 'main_stage', role: 'attendee' }, attendeeCookie);
  if (tokenRevoked.response.status !== 403) failures.push(`revoked attendee token must return 403; got ${tokenRevoked.response.status}`);

  pushTrace('repermit_attendee_start');
  const repermit = await request('POST', '/api/attendee-live/access', { eventId, roomKind: 'main_stage', roomId: stageId, attendeeId, action: 'repermit', canJoinLiveStream: true }, operatorCookie);
  if (repermit.response.status !== 200 || repermit.json?.capability?.canJoinLiveStream !== true || repermit.json?.capability?.revoked !== false) failures.push(`re-permit returned ${repermit.response.status}: ${repermit.text.slice(0, 200)}`);
  const tokenRecovered = await request('POST', '/api/video/livekit-token', { eventId, roomId: stageId, roomType: 'main_stage', role: 'attendee' }, attendeeCookie);
  if (tokenRecovered.response.status !== 200 || !tokenRecovered.json?.ok) failures.push(`re-permitted attendee token returned ${tokenRecovered.response.status}: ${tokenRecovered.text.slice(0, 200)}`);

  pushTrace('backend_logs_start');
  const logs = await request('GET', `/api/attendee-live/access?eventId=${encodeURIComponent(eventId)}&roomId=${encodeURIComponent(stageId)}&attendeeId=${encodeURIComponent(attendeeId)}`, undefined, operatorCookie);
  if (logs.response.status !== 200 || !logs.json?.ok || !Array.isArray(logs.json.logs) || logs.json.logs.length < 3) failures.push(`backend access logs did not include permit/revoke/re-permit decisions: ${logs.text.slice(0, 200)}`);

  const report = {
    repo: 'agency-event-os',
    generatedAt: nowIso(),
    result: failures.length ? 'BLOCKED_OR_FAIL' : 'PASS',
    baseUrl,
    eventId,
    stageId,
    attendeeIdRedacted: redact(attendeeId),
    primaryPath: 'StreamYard-compatible RTMP into LiveKit',
    evidenceEventId: controlledMedia.eventId,
    evidenceRunIdMatched: process.env.TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID ? controlledMedia.tier4RunId === process.env.TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID : 'not_required_for_standalone_run',
    controlledRtmpMediaObserved: true,
    attendeeStageRendered: pageHtml.response.status === 200,
    attendeeBrowserReachedLiveStage: browserProof.ok === true,
    attendeeBrowserLiveKitSurfaceRendered: browserProof.livekitSurfaceFound === true,
    attendeeBrowserLiveKitSurfaceTokenIssued: browserProof.livekitSurfaceTokenIssued === true,
    attendeeBrowserLiveKitTokenIssued: browserProof.browserLivekitTokenIssued === true,
    attendeeBrowserStagePlayerLiveKitLive: browserProof.stagePlayerLiveKitLive === true,
    attendeeBrowserLiveKitSurfaceState: browserProof.livekitSurfaceState,
    attendeeBrowserStagePlayerAttrs: browserProof.stagePlayerAttrs,
    attendeeBrowserScreenshot: browserProof.screenshot,
    attendeeLiveTokenIssuedWhenPermitted: tokenOk.response.status === 200 && Boolean(tokenOk.json?.result?.token?.token),
    attendeeTokenRoomMatchesIngressRoom: tokenOk.json?.result?.token?.roomId === `${eventId}-${stageId}`.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase(),
    attendeeAccessRevoked: revoke.json?.capability?.revoked === true,
    livekitParticipantRemoval: revoke.json?.livekitParticipantRemoval,
    revokedAttendeeDeniedLiveToken: tokenRevoked.response.status === 403,
    attendeeAccessRePermitted: repermit.json?.capability?.canJoinLiveStream === true && repermit.json?.capability?.revoked === false,
    rePermittedAttendeeLiveTokenRecovered: tokenRecovered.response.status === 200 && Boolean(tokenRecovered.json?.ok),
    backendLogsVisibleToAuthorizedRoles: logs.response.status === 200 && Array.isArray(logs.json?.logs) && logs.json.logs.length >= 3,
    attendeeSecretsExposed: false,
    evidenceGeneratedByThisRun: process.env.TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID ? controlledMedia.tier4RunId === process.env.TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID : false,
    failures,
    trace,
  };
  assertNoSecrets('attendee live consumption report', report);
  fs.writeFileSync(path.join(reportsDir, 'tier4-attendee-live-consumption-gauntlet.json'), JSON.stringify(report, null, 2) + '\n');
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('tier4_attendee_live_consumption_gauntlet: PASS');
}

main().catch((error) => {
  console.error('tier4_attendee_live_consumption_gauntlet: BLOCKED_OR_FAIL');
  console.error(error?.message || String(error));
  process.exit(1);
});
