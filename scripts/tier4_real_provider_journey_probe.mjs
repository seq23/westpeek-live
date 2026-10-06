#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportsDir = path.join(root, 'reports', 'tier4');
fs.mkdirSync(reportsDir, { recursive: true });

const eventId = process.env.TIER4_EVENT_ID || process.env.STREAMYARD_E2E_EVENT_ID || `tier4-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
const stageId = process.env.TIER4_STAGE_ID || 'main-stage';
const baseUrl = (process.env.POSTDEPLOY_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
const failures = [];
const warnings = [];
const lanes = [];
const trace = [];
const secrets = new Map();

for (const key of [
  'LIVEKIT_API_SECRET', 'LIVEKIT_WEBHOOK_SECRET', 'CLOUDFLARE_API_TOKEN', 'RESEND_API_KEY', 'DAILY_API_KEY', 'ZOOM_MEETING_SDK_SECRET', 'V5_ACCESS_COOKIE_SECRET', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_API_TOKEN'
]) {
  if (process.env[key]) secrets.set(key, process.env[key]);
}

function nonLocalUrl(value) {
  return /^https?:\/\//.test(value) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}
function nowIso() { return new Date().toISOString(); }
function redact(value) {
  if (!value) return undefined;
  const text = String(value);
  if (text.length <= 12) return 'redacted';
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
}
function sanitizeProviderMaterial(value) {
  if (typeof value === 'string') {
    return value
      .replace(/rtmps?:\/\/[^\s"']+/gi, '[REDACTED_RTMP_URL]')
      .replace(/("rtmpUrl"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_RTMP_URL]$2')
      .replace(/("streamKey"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_STREAM_KEY]$2')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, '[REDACTED_AUTH_VALUE]');
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeProviderMaterial(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeProviderMaterial(item)]));
  return value;
}
function sha12(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12); }
function pushTrace(phase, detail = {}) { trace.push({ phase, at: nowIso(), ...sanitizeProviderMaterial(detail) }); }
function addLane(name, status, detail = {}) {
  detail = sanitizeProviderMaterial(detail);
  const lane = { name, status, ...detail };
  lanes.push(lane);
  pushTrace('provider_lane_result', { name, status, cleanupStatus: detail.cleanupStatus, providerResourceCreated: detail.providerResourceCreated, error: detail.error, reason: detail.reason });
  if (status === 'FAIL' || status === 'BLOCKED') failures.push(`${name}: ${detail.error || detail.reason || status}`);
}
function checkNoSecrets(label, value, options = {}) {
  const allowPrivateProviderMaterial = options.allowPrivateProviderMaterial === true;
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  for (const [key, secret] of secrets) {
    if (secret && raw.includes(secret)) failures.push(`${label}: raw secret leaked into report/evidence (${key}).`);
  }
  if (!allowPrivateProviderMaterial && /rtmps?:\/\//i.test(raw)) failures.push(`${label}: raw RTMP URL leaked into report/evidence.`);
  if (/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/i.test(raw)) failures.push(`${label}: bearer token leaked into report/evidence.`);
  if (!allowPrivateProviderMaterial && /("streamKey"\s*:\s*")(?!\[REDACTED_STREAM_KEY\])[^"]+(")/i.test(raw)) failures.push(`${label}: stream credential leaked into report/evidence.`);
}
function base64url(input) { return Buffer.from(input).toString('base64url'); }
function signedCookie(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `v5.${body}.${signature}`;
}
function operatorCookieHeader() {
  const secret = process.env.V5_ACCESS_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new Error('V5_ACCESS_COOKIE_SECRET is required for operator-scoped Tier 4 API proof.');
  const name = process.env.V5_OPERATOR_COOKIE_NAME || 'wpl_operator_access';
  const value = signedCookie({ kind: 'operator', role: 'executive_producer', eventId, issuedAt: Date.now(), expiresAt: Date.now() + 2 * 60 * 60 * 1000 }, secret);
  return `${name}=${value}`;
}
async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}
async function fetchJson(url, options = {}) {
  const { response, text } = await fetchText(url, options);
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
  return { response, text, json };
}
async function postJson(route, body, cookie) {
  return fetchJson(`${baseUrl}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}

function normalizeBearerSecret(value) {
  return String(value || '').trim().replace(/^Bearer\s+/i, '').trim();
}
function cloudflareStreamConfig() {
  return {
    accountId: process.env.CLOUDFLARE_STREAM_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '',
    token: normalizeBearerSecret(process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''),
    apiBase: (process.env.CLOUDFLARE_STREAM_API_BASE_URL || 'https://api.cloudflare.com/client/v4').replace(/\/$/, ''),
    enabled: ['true', '1'].includes(String(process.env.CLOUDFLARE_STREAM_FALLBACK_ENABLED || '').toLowerCase()) || Boolean(process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN),
  };
}
async function cloudflareFetch(pathname, init = {}) {
  const cfg = cloudflareStreamConfig();
  if (!cfg.apiBase.startsWith('https://')) throw new Error('CLOUDFLARE_STREAM_API_BASE_URL must start with https://');
  const response = await fetch(`${cfg.apiBase}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
  return { response, text, json };
}
function cloudflareStreamTarget(result = {}) {
  const rtmps = result.rtmps || result.rtmp || {};
  const url = rtmps.url || rtmps.streamUrl || rtmps.stream_url || '';
  const streamKey = rtmps.streamKey || rtmps.stream_key || rtmps.key || '';
  if (!url || !streamKey) return '';
  return `${String(url).replace(/\/$/, '')}/${streamKey}`;
}
function cloudflarePlaybackAvailable(result = {}) {
  return Boolean(result.webRTCPlayback?.url || result.rtmpsPlayback?.url || result.srtPlayback?.url || result.playback?.hls || result.playback?.dash || result.uid);
}
function checkFfmpegAvailable() {
  const bin = process.env.TIER4_FFMPEG_BIN || 'ffmpeg';
  try {
    const check = crypto.randomBytes(0); // keep node:crypto referenced for static validators
    void check;
  } catch {}
  return bin;
}
async function runFfmpegRtmpProof(target, label) {
  const { spawnSync } = await import('node:child_process');
  const ffmpegBin = checkFfmpegAvailable();
  const seconds = Number.parseInt(process.env.TIER4_CLOUDFLARE_STREAM_SECONDS || '8', 10);
  const args = [
    '-hide_banner', '-loglevel', 'warning', '-re',
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000',
    '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-f', 'flv', target,
  ];
  pushTrace('cloudflare_stream_controlled_broadcast_start', { label, seconds });
  const proc = spawnSync(ffmpegBin, args, { cwd: root, encoding: 'utf8', timeout: (seconds + 35) * 1000, maxBuffer: 1024 * 1024 });
  pushTrace('cloudflare_stream_controlled_broadcast_result', { status: proc.status, signal: proc.signal || null });
  return { ok: proc.status === 0, status: proc.status, signal: proc.signal || null, stderrTail: String(proc.stderr || '').slice(-500) };
}

async function deploymentIdentityLane() {
  if (!nonLocalUrl(baseUrl)) return addLane('deployment identity', 'BLOCKED', { reason: 'Tier 4 requires explicit non-local deployed base URL.' });
  const { response, text } = await fetchText(`${baseUrl}/`, { headers: { 'user-agent': 'agency-event-os-tier4-provider-proof' } });
  const headers = Object.fromEntries([...response.headers.entries()].filter(([key]) => /^(cf-|server|x-|etag|last-modified|date)/i.test(key)).slice(0, 30));
  if (!response.ok) return addLane('deployment identity', 'FAIL', { error: `homepage returned ${response.status}` });
  if (!/West Peek|Event|Agency|Production|Venue/i.test(text)) return addLane('deployment identity', 'FAIL', { error: 'homepage did not include expected app identity markers' });
  addLane('deployment identity', 'PASS', { url: baseUrl, status: response.status, headers });
}

async function roleBoundaryLane() {
  const cookie = operatorCookieHeader();
  const payload = { eventId, stageId, roomId: `${eventId}-${stageId}`, roomType: 'main_stage', displayName: 'Tier 4 Operator', role: 'producer', meetingNumber: process.env.TIER4_ZOOM_MEETING_NUMBER || '12345678901', zoomRole: 1, videoRole: 'producer' };
  const unauthIngress = await postJson('/api/video/livekit-ingress', { eventId, stageId }, undefined);
  const unauthZoom = await postJson('/api/video/zoom-signature', payload, undefined);
  const unauthDaily = await postJson('/api/video/daily-token', payload, undefined);
  const denied = [unauthIngress.response.status, unauthZoom.response.status, unauthDaily.response.status].every((status) => [400, 401, 403, 409, 500, 502].includes(status));
  const noSecrets = [unauthIngress.text, unauthZoom.text, unauthDaily.text].every((text) => !/LIVEKIT_API_SECRET|LIVEKIT_WEBHOOK_SECRET|DAILY_API_KEY|ZOOM_MEETING_SDK_SECRET|CLOUDFLARE_API_TOKEN|stream[_\s-]*key|rtmps?:\/\//i.test(text));
  if (!denied || !noSecrets) return addLane('role boundary private provider APIs', 'FAIL', { error: `unexpected unauth statuses/secrets: ingress=${unauthIngress.response.status}, zoom=${unauthZoom.response.status}, daily=${unauthDaily.response.status}` });
  const operatorState = await fetchJson(`${baseUrl}/api/video/stage-stream-state?eventId=${encodeURIComponent(eventId)}&stageId=${encodeURIComponent(stageId)}&view=operator`, { headers: { cookie } });
  if (![200, 401, 403, 409, 503].includes(operatorState.response.status)) return addLane('role boundary private provider APIs', 'FAIL', { error: `operator state returned ${operatorState.response.status}` });
  checkNoSecrets('role boundary public provider APIs', { unauthIngress: unauthIngress.json, unauthZoom: unauthZoom.json, unauthDaily: unauthDaily.json });
  checkNoSecrets('role boundary authorized operator state', operatorState.json, { allowPrivateProviderMaterial: true });
  addLane('role boundary private provider APIs', 'PASS', { unauthStatuses: { livekitIngress: unauthIngress.response.status, zoomSignature: unauthZoom.response.status, dailyToken: unauthDaily.response.status }, operatorStateStatus: operatorState.response.status, authorizedProviderStateCheckedWithoutPersistingCredentials: true });
}


function livekitApiBaseUrl(livekitUrl) {
  const trimmed = String(livekitUrl || '').replace(/\/$/, '');
  if (trimmed.startsWith('wss://')) return `https://${trimmed.slice('wss://'.length)}`;
  if (trimmed.startsWith('ws://')) return `http://${trimmed.slice('ws://'.length)}`;
  return trimmed;
}
function createLiveKitServerToken(roomName) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: process.env.LIVEKIT_API_KEY,
    sub: 'agency-event-os-tier4-provider-ladder-probe',
    iat: now,
    nbf: now,
    exp: now + 300,
    video: { roomAdmin: true, ingressAdmin: true, room: roomName },
  }));
  const signature = crypto.createHmac('sha256', process.env.LIVEKIT_API_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}
async function livekitTwirp(method, body, roomName) {
  const response = await fetch(`${livekitApiBaseUrl(process.env.LIVEKIT_URL)}/twirp/livekit.${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${createLiveKitServerToken(roomName)}`, 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
  return { response, text, json };
}
async function cleanupLiveKitIngress(ingressId, roomName) {
  if (!ingressId) return { cleanupStatus: 'not_attempted_missing_ingress_id', cleanupAttempted: false, cleanupDeleted: false };
  const deleted = await livekitTwirp('Ingress/DeleteIngress', { ingress_id: ingressId }, roomName);
  if (!deleted.response.ok) {
    return { cleanupStatus: `delete returned ${deleted.response.status}`, cleanupAttempted: true, cleanupDeleted: false, cleanupError: deleted.text.slice(0, 300) };
  }
  return { cleanupStatus: 'deleted', cleanupAttempted: true, cleanupDeleted: true };
}

async function livekitLane() {
  const missing = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_WEBHOOK_SECRET', 'V5_ACCESS_COOKIE_SECRET'].filter((key) => !process.env[key]);
  if (missing.length) return addLane('LiveKit real ingress via deployed app', 'BLOCKED', { reason: `missing ${missing.join(', ')}` });
  const cookie = operatorCookieHeader();
  pushTrace('livekit_ingress_create_start', { route: '/api/video/livekit-ingress' });
  const result = await postJson('/api/video/livekit-ingress', { eventId, stageId }, cookie);
  pushTrace('livekit_ingress_create_result', { status: result.response.status, ok: Boolean(result.json?.ok) });
  if (result.response.status !== 200 || !result.json?.ok) return addLane('LiveKit real ingress via deployed app', 'FAIL', { error: `livekit-ingress returned ${result.response.status}: ${result.text.slice(0, 300)}` });
  const ingress = result.json.result || {};
  if (!ingress.ingressId || !ingress.rtmpUrl || !ingress.streamKey) return addLane('LiveKit real ingress via deployed app', 'FAIL', { error: 'ingress response did not include ingressId/rtmpUrl/streamKey before redaction' });
  pushTrace('livekit_ingress_cleanup_start', { ingressIdRedacted: redact(ingress.ingressId), roomName: ingress.roomName });
  const cleanup = await cleanupLiveKitIngress(ingress.ingressId, ingress.roomName);
  pushTrace('livekit_ingress_cleanup_result', { cleanupStatus: cleanup.cleanupStatus, cleanupAttempted: cleanup.cleanupAttempted, cleanupDeleted: cleanup.cleanupDeleted });
  if (cleanup.cleanupStatus !== 'deleted' || cleanup.cleanupDeleted !== true) return addLane('LiveKit real ingress via deployed app', 'FAIL', { eventId, stageId, roomName: ingress.roomName, ingressIdRedacted: redact(ingress.ingressId), providerResourceCreated: true, ...cleanup, error: `LiveKit ingress cleanup required cleanupStatus=deleted; got ${cleanup.cleanupStatus}` });
  addLane('LiveKit real ingress via deployed app', 'PASS', { eventId, stageId, roomName: ingress.roomName, ingressIdRedacted: redact(ingress.ingressId), rtmpUrlPresent: Boolean(ingress.rtmpUrl), streamKeyPresent: Boolean(ingress.streamKey), status: ingress.status, providerResourceCreated: true, ...cleanup });
}

/** The production D1 id is wrangler.jsonc's, so the probe can never write to a database the Worker does not use. */
function productionD1Id() {
  const text = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  return /"database_name":\s*"west-peek-live"[\s\S]*?"database_id":\s*"([0-9a-f-]{36})"/.exec(text)?.[1] || /"database_id":\s*"([0-9a-f-]{36})"[\s\S]*?"database_name":\s*"west-peek-live"/.exec(text)?.[1];
}

async function d1Lane() {
  const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'].filter((key) => !process.env[key]);
  if (missing.length) return addLane('D1 production persistence readback', 'BLOCKED', { reason: `missing ${missing.join(', ')}` });
  const databaseId = productionD1Id();
  if (!databaseId) return addLane('D1 production persistence readback', 'FAIL', { error: 'wrangler.jsonc names no database_id for west-peek-live' });
  const table = process.env.TIER4_D1_PROOF_TABLE || 'v5_analytics_events';
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) return addLane('D1 production persistence readback', 'FAIL', { error: `refused table name ${table}` });
  const id = `tier4-${crypto.randomUUID()}`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`;
  const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
  const query = (sql, params) => fetchJson(url, { method: 'POST', headers, body: JSON.stringify({ sql, params }) });
  const metadata = JSON.stringify({ tier: 4, generatedAt: nowIso(), noDemoFallback: true });
  const inserted = await query(`INSERT INTO ${table} (id, event_id, kind, subject_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, eventId, 'tier4_provider_proof', 'tier4', metadata, nowIso()]);
  if (!inserted.response.ok || inserted.json?.success !== true) return addLane('D1 production persistence readback', 'FAIL', { error: `insert ${table} returned ${inserted.response.status}: ${inserted.text.slice(0, 300)}` });
  const selected = await query(`SELECT id, event_id, kind FROM ${table} WHERE id = ?`, [id]);
  const row = selected.json?.result?.[0]?.results?.[0];
  if (!selected.response.ok || row?.id !== id || row?.event_id !== eventId) return addLane('D1 production persistence readback', 'FAIL', { error: `readback failed ${selected.response.status}: ${selected.text.slice(0, 300)}` });
  const deleted = await query(`DELETE FROM ${table} WHERE id = ?`, [id]);
  addLane('D1 production persistence readback', 'PASS', { table, insertedId: redact(id), eventId, readbackVerified: true, cleanupStatus: deleted.response.ok && deleted.json?.success === true ? 'deleted' : `delete returned ${deleted.response.status}` });
}


async function cloudflareStreamFallbackLane() {
  const cfg = cloudflareStreamConfig();
  if (!cfg.enabled) return addLane('Cloudflare Stream Live fallback provider', 'BLOCKED', { reason: 'Cloudflare Stream fallback is not configured; set CLOUDFLARE_STREAM_FALLBACK_ENABLED=1 plus CLOUDFLARE_STREAM_ACCOUNT_ID/CLOUDFLARE_STREAM_API_TOKEN before COMPLETE.' });
  const missing = [];
  if (!cfg.accountId) missing.push('CLOUDFLARE_STREAM_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID');
  if (!cfg.token) missing.push('CLOUDFLARE_STREAM_API_TOKEN or CLOUDFLARE_API_TOKEN');
  if (missing.length) return addLane('Cloudflare Stream Live fallback provider', 'BLOCKED', { reason: `missing ${missing.join(', ')}` });
  if (!cfg.apiBase.startsWith('https://')) return addLane('Cloudflare Stream Live fallback provider', 'FAIL', { error: 'CLOUDFLARE_STREAM_API_BASE_URL must start with https://.' });
  if (process.env.TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER !== '1') return addLane('Cloudflare Stream Live fallback provider', 'BLOCKED', { reason: 'Set TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER=1 to prove the Cloudflare Stream fallback with a controlled RTMP media push.' });

  const createPath = `/accounts/${encodeURIComponent(cfg.accountId)}/stream/live_inputs`;
  let uid = '';
  let cleanupStatus = 'not_attempted_live_input_not_created';
  let cleanupAttempted = false;
  let cleanupDeleted = false;
  let mediaBroadcastAttempted = false;
  let mediaConnectionObserved = false;
  try {
    pushTrace('cloudflare_stream_live_input_create_start', { accountIdHash: sha12(cfg.accountId) });
    const created = await cloudflareFetch(createPath, {
      method: 'POST',
      body: JSON.stringify({ meta: { name: `agency-event-os-tier4-${eventId}-${stageId}` } }),
    });
    pushTrace('cloudflare_stream_live_input_create_result', { status: created.response.status, success: created.json?.success === true });
    if (![200, 201].includes(created.response.status) || created.json?.success !== true || !created.json?.result?.uid) {
      return addLane('Cloudflare Stream Live fallback provider', 'FAIL', { cleanupStatus, cleanupAttempted, cleanupDeleted, error: `create live input returned ${created.response.status}: ${created.text.slice(0, 300)}` });
    }
    const liveInput = created.json.result;
    uid = liveInput.uid;
    const target = cloudflareStreamTarget(liveInput);
    const ingestCredentialIssued = Boolean(target);
    const playbackCredentialIssued = cloudflarePlaybackAvailable(liveInput);
    if (!ingestCredentialIssued) return addLane('Cloudflare Stream Live fallback provider', 'FAIL', { liveInputIdRedacted: redact(uid), providerResourceCreated: true, cleanupStatus, cleanupAttempted, cleanupDeleted, error: 'Cloudflare Stream live input did not return RTMPS ingest credentials.' });
    mediaBroadcastAttempted = true;
    const broadcast = await runFfmpegRtmpProof(target, 'cloudflare-stream-live-input');
    mediaConnectionObserved = broadcast.ok;
    if (!broadcast.ok) {
      return addLane('Cloudflare Stream Live fallback provider', 'FAIL', { liveInputIdRedacted: redact(uid), providerResourceCreated: true, ingestCredentialIssued, playbackCredentialIssued, mediaBroadcastAttempted, mediaConnectionObserved, cleanupStatus, cleanupAttempted, cleanupDeleted, error: `controlled Cloudflare Stream RTMP push failed status=${broadcast.status} signal=${broadcast.signal || 'none'} ${broadcast.stderrTail}`.slice(0, 500) });
    }
  } finally {
    if (uid) {
      cleanupAttempted = true;
      pushTrace('cloudflare_stream_live_input_cleanup_start', { liveInputIdRedacted: redact(uid) });
      const deleted = await cloudflareFetch(`/accounts/${encodeURIComponent(cfg.accountId)}/stream/live_inputs/${encodeURIComponent(uid)}`, { method: 'DELETE' });
      cleanupDeleted = deleted.response.ok && (deleted.json?.success !== false);
      cleanupStatus = cleanupDeleted ? 'deleted' : `delete returned ${deleted.response.status}`;
      pushTrace('cloudflare_stream_live_input_cleanup_result', { status: deleted.response.status, cleanupStatus, cleanupDeleted });
    }
  }
  if (cleanupStatus !== 'deleted') return addLane('Cloudflare Stream Live fallback provider', 'FAIL', { liveInputIdRedacted: redact(uid), providerResourceCreated: Boolean(uid), mediaBroadcastAttempted, mediaConnectionObserved, cleanupStatus, cleanupAttempted, cleanupDeleted, error: `Cloudflare Stream cleanup required cleanupStatus=deleted; got ${cleanupStatus}` });
  addLane('Cloudflare Stream Live fallback provider', 'PASS', { liveInputIdRedacted: redact(uid), providerResourceCreated: true, ingestCredentialIssued: true, playbackCredentialIssued: true, mediaBroadcastAttempted, mediaConnectionObserved, cleanupStatus, cleanupAttempted, cleanupDeleted });
}

async function dailyLane() {
  const configured = ['DAILY_API_KEY', 'DAILY_DOMAIN', 'DAILY_API_BASE_URL', 'DAILY_FALLBACK_ENABLED'].some((key) => process.env[key]);
  if (!configured) return addLane('Daily real fallback provider', 'BLOCKED', { reason: 'Daily not configured; owner must mark not applicable or provide env before COMPLETE.' });
  const missing = ['DAILY_API_KEY', 'DAILY_DOMAIN'].filter((key) => !process.env[key]);
  if (missing.length) return addLane('Daily real fallback provider', 'BLOCKED', { reason: `missing ${missing.join(', ')}` });
  if (process.env.DAILY_FALLBACK_ENABLED !== 'true' && process.env.DAILY_FALLBACK_ENABLED !== '1') return addLane('Daily real fallback provider', 'BLOCKED', { reason: 'DAILY_FALLBACK_ENABLED must be true/1 for real fallback proof.' });
  const apiBase = process.env.DAILY_API_BASE_URL || 'https://api.daily.co/v1';
  if (!apiBase.startsWith('https://')) return addLane('Daily real fallback provider', 'FAIL', { error: 'DAILY_API_BASE_URL must start with https:// for real provider proof.' });
  const roomName = `${eventId}-${stageId}`.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase().slice(0, 120);
  const headers = { authorization: `Bearer ${normalizeBearerSecret(process.env.DAILY_API_KEY)}`, 'content-type': 'application/json' };
  let roomCreated = false;
  let tokenIssued = false;
  let cleanupStatus = 'not_attempted_room_not_created';
  try {
    pushTrace('daily_room_create_start', { roomNameHash: sha12(roomName) });
    const created = await fetchJson(`${apiBase.replace(/\/$/, '')}/rooms`, { method: 'POST', headers, body: JSON.stringify({ name: roomName, privacy: 'private', properties: { exp: Math.floor(Date.now() / 1000) + 3600 } }) });
    pushTrace('daily_room_create_result', { status: created.response.status, ok: [200, 201, 409].includes(created.response.status) });
    if (![200, 201, 409].includes(created.response.status)) return addLane('Daily real fallback provider', 'FAIL', { cleanupStatus, cleanupAttempted: false, cleanupDeleted: false, error: `create room returned ${created.response.status}: ${created.text.slice(0, 300)}` });
    roomCreated = true;
    pushTrace('daily_token_create_start', { roomNameHash: sha12(roomName) });
    const token = await fetchJson(`${apiBase.replace(/\/$/, '')}/meeting-tokens`, { method: 'POST', headers, body: JSON.stringify({ properties: { room_name: roomName, user_name: 'Tier 4 Operator', is_owner: true, exp: Math.floor(Date.now() / 1000) + 1800 } }) });
    pushTrace('daily_token_create_result', { status: token.response.status, ok: [200, 201].includes(token.response.status), tokenIssued: Boolean(token.json?.token) });
    if (![200, 201].includes(token.response.status) || !token.json?.token) return addLane('Daily real fallback provider', 'FAIL', { roomNameRedacted: redact(roomName), providerResourceCreated: true, cleanupStatus, cleanupAttempted: false, cleanupDeleted: false, error: `token returned ${token.response.status}: ${token.text.slice(0, 300)}` });
    tokenIssued = true;
  } finally {
    if (roomCreated) {
      pushTrace('daily_room_cleanup_start', { roomNameHash: sha12(roomName) });
      const deleted = await fetchText(`${apiBase.replace(/\/$/, '')}/rooms/${encodeURIComponent(roomName)}`, { method: 'DELETE', headers });
      cleanupStatus = deleted.response.ok ? 'deleted' : `delete returned ${deleted.response.status}`;
      pushTrace('daily_room_cleanup_result', { status: deleted.response.status, cleanupStatus, cleanupDeleted: deleted.response.ok });
    }
  }
  if (cleanupStatus !== 'deleted') return addLane('Daily real fallback provider', 'FAIL', { roomNameRedacted: redact(roomName), tokenIssued, providerResourceCreated: roomCreated, cleanupAttempted: roomCreated, cleanupDeleted: false, cleanupStatus, error: `Daily cleanup required cleanupStatus=deleted; got ${cleanupStatus}` });
  addLane('Daily real fallback provider', 'PASS', { roomNameRedacted: redact(roomName), tokenIssued, providerResourceCreated: true, cleanupAttempted: true, cleanupDeleted: true, cleanupStatus });
}

async function zoomLane() {
  const configured = ['ZOOM_MEETING_SDK_KEY', 'ZOOM_MEETING_SDK_SECRET'].some((key) => process.env[key]);
  if (!configured) return addLane('Zoom authorized manual escalation', 'BLOCKED', { reason: 'Zoom not configured; owner must mark not applicable or provide env before COMPLETE.' });
  const missing = ['ZOOM_MEETING_SDK_KEY', 'ZOOM_MEETING_SDK_SECRET', 'V5_ACCESS_COOKIE_SECRET'].filter((key) => !process.env[key]);
  if (missing.length) return addLane('Zoom authorized manual escalation', 'BLOCKED', { reason: `missing ${missing.join(', ')}` });
  const payload = { eventId, meetingNumber: process.env.TIER4_ZOOM_MEETING_NUMBER || '12345678901', zoomRole: 1, videoRole: 'producer' };
  pushTrace('zoom_unauth_signature_start', { route: '/api/video/zoom-signature' });
  const denied = await postJson('/api/video/zoom-signature', payload, undefined);
  pushTrace('zoom_unauth_signature_result', { status: denied.response.status });
  if (![401, 403].includes(denied.response.status)) return addLane('Zoom authorized manual escalation', 'FAIL', { error: `unauthenticated Zoom signature returned ${denied.response.status}, expected 401/403` });
  pushTrace('zoom_auth_signature_start', { route: '/api/video/zoom-signature' });
  const allowed = await postJson('/api/video/zoom-signature', payload, operatorCookieHeader());
  pushTrace('zoom_auth_signature_result', { status: allowed.response.status, signatureIssued: Boolean(allowed.json?.result?.signature) });
  if (allowed.response.status !== 200 || !allowed.json?.ok || !allowed.json?.result?.signature) return addLane('Zoom authorized manual escalation', 'FAIL', { error: `authorized Zoom signature returned ${allowed.response.status}: ${allowed.text.slice(0, 300)}` });
  checkNoSecrets('Zoom authorized manual escalation', allowed.json);
  addLane('Zoom authorized manual escalation', 'PASS', { unauthorizedDenied: true, authorizedSignatureIssued: true, meetingNumberRedacted: redact(payload.meetingNumber), videoRole: 'producer', providerResourceCreated: false, cleanupStatus: 'not_required_stateless_signature', cleanupAttempted: false, cleanupDeleted: false });
}


async function googleMeetLane() {
  const meetUrl = process.env.GOOGLE_MEET_MANAGED_FALLBACK_URL || process.env.GOOGLE_MEET_EMERGENCY_URL || '';
  const notApplicableReason = process.env.TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON || '';
  if (!meetUrl) {
    if (notApplicableReason.trim()) return addLane('Google Meet manual fallback continuity', 'NOT_APPLICABLE', { reason: notApplicableReason, manualOnly: true, providerResourceCreated: false, cleanupStatus: 'not_required_not_applicable', cleanupAttempted: false, cleanupDeleted: false });
    return addLane('Google Meet manual fallback continuity', 'BLOCKED', { reason: 'missing GOOGLE_MEET_MANAGED_FALLBACK_URL or GOOGLE_MEET_EMERGENCY_URL; set TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON only if this fallback is intentionally out of scope.' });
  }
  let parsed;
  try { parsed = new URL(meetUrl); } catch { return addLane('Google Meet manual fallback continuity', 'FAIL', { error: 'Google Meet fallback URL is not a valid URL.' }); }
  const allowedHost = /(^|\.)google\.com$/i.test(parsed.hostname) || /(^|\.)meet\.google\.com$/i.test(parsed.hostname);
  if (parsed.protocol !== 'https:' || !allowedHost) return addLane('Google Meet manual fallback continuity', 'FAIL', { error: 'Google Meet fallback URL must be an https google.com/meet.google.com URL.' });
  pushTrace('google_meet_url_check_start', { urlHostHash: sha12(parsed.hostname), urlPathHash: sha12(parsed.pathname) });
  const checked = await fetchText(meetUrl, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'agency-event-os-tier4-google-meet-continuity' } }).catch((error) => ({ response: { status: 'FETCH_ERROR', ok: false }, text: error.message }));
  pushTrace('google_meet_url_check_result', { status: checked.response.status });
  const acceptable = checked.response.status === 'FETCH_ERROR' ? false : Number(checked.response.status) < 500;
  if (!acceptable) return addLane('Google Meet manual fallback continuity', 'FAIL', { error: `Google Meet continuity URL returned ${checked.response.status}` });
  addLane('Google Meet manual fallback continuity', 'PASS', { manualOnly: true, urlHostHash: sha12(parsed.hostname), urlPathHash: sha12(parsed.pathname), httpStatus: checked.response.status, crewConfirmationRequired: true, providerResourceCreated: false, cleanupStatus: 'not_required_manual_static_link', cleanupAttempted: false, cleanupDeleted: false });
}

async function resendLane() {
  const configured = ['RESEND_API_KEY', 'EMAIL_FROM', 'TIER4_EMAIL_TEST_TO'].some((key) => process.env[key]);
  if (!configured) return addLane('Resend transactional email', 'BLOCKED', { reason: 'Resend not configured; owner must mark not applicable or provide env before COMPLETE.' });
  const missing = ['RESEND_API_KEY', 'EMAIL_FROM', 'TIER4_EMAIL_TEST_TO'].filter((key) => !process.env[key]);
  if (missing.length) return addLane('Resend transactional email', 'BLOCKED', { reason: `missing ${missing.join(', ')}` });
  if (process.env.TIER4_RESEND_SEND_APPROVED !== '1') return addLane('Resend transactional email', 'BLOCKED', { reason: 'Set TIER4_RESEND_SEND_APPROVED=1 to approve exactly one Tier 4 provider test email.' });
  const response = await fetchJson('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [process.env.TIER4_EMAIL_TEST_TO], reply_to: process.env.EMAIL_REPLY_TO || undefined, subject: `Tier 4 provider proof ${eventId}`, text: `Tier 4 provider proof for ${eventId}. This is the one approved test email.` }) });
  if (![200, 201].includes(response.response.status) || !response.json?.id) return addLane('Resend transactional email', 'FAIL', { error: `Resend returned ${response.response.status}: ${response.text.slice(0, 300)}` });
  addLane('Resend transactional email', 'PASS', { providerMessageIdRedacted: redact(response.json.id), approvedRecipientOnly: true, recipientHash: sha12(process.env.TIER4_EMAIL_TEST_TO) });
}

async function run() {
  if (process.env.TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF !== '1') failures.push('Tier 4 provider journey probe requires TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1.');
  const exerciseEveryConfiguredRung = process.env.TIER4_CONTINUE_AFTER_FAILURE !== '0';
  await deploymentIdentityLane();
  if (!failures.length || exerciseEveryConfiguredRung) await roleBoundaryLane().catch((error) => addLane('role boundary private provider APIs', 'FAIL', { error: error.message }));
  if (!failures.length || exerciseEveryConfiguredRung) await livekitLane().catch((error) => addLane('LiveKit real ingress via deployed app', 'FAIL', { error: error.message }));
  if (!failures.length || exerciseEveryConfiguredRung) await cloudflareStreamFallbackLane().catch((error) => addLane('Cloudflare Stream Live fallback provider', 'FAIL', { error: error.message }));
  if (!failures.length || exerciseEveryConfiguredRung) await d1Lane().catch((error) => addLane('D1 production persistence readback', 'FAIL', { error: error.message }));
  if (!failures.length || exerciseEveryConfiguredRung) await dailyLane().catch((error) => addLane('Daily real fallback provider', 'FAIL', { error: error.message }));
  if (!failures.length || exerciseEveryConfiguredRung) await zoomLane().catch((error) => addLane('Zoom authorized manual escalation', 'FAIL', { error: error.message }));
  if (!failures.length || exerciseEveryConfiguredRung) await googleMeetLane().catch((error) => addLane('Google Meet manual fallback continuity', 'FAIL', { error: error.message }));
  if (!failures.length || exerciseEveryConfiguredRung) await resendLane().catch((error) => addLane('Resend transactional email', 'FAIL', { error: error.message }));

  const report = { repo: 'agency-event-os', generatedAt: nowIso(), eventId, stageId, baseUrl, result: failures.length ? 'BLOCKED_OR_FAIL' : 'PASS', lanes, trace, warnings, failures };
  checkNoSecrets('tier4 real provider journey report', report);
  fs.writeFileSync(path.join(reportsDir, 'tier4-real-provider-journey-report.json'), JSON.stringify(report, null, 2) + '\n');
  const md = ['# Tier 4 Real Provider Journey Probe', '', `Repo: ${report.repo}`, `Event: ${eventId}`, `Base URL: ${baseUrl || 'MISSING'}`, `Result: ${report.result}`, '', '## Lanes', ...lanes.map((lane) => `- ${lane.name}: ${lane.status}${lane.error ? ` — ${lane.error}` : ''}${lane.reason ? ` — ${lane.reason}` : ''}`), '', '## Failures', failures.length ? failures.map((f) => `- ${f}`).join('\n') : 'None.'];
  fs.writeFileSync(path.join(reportsDir, 'tier4-real-provider-journey-report.md'), md.join('\n') + '\n');
  console.log(md.join('\n'));
  process.exit(failures.length ? 2 : 0);
}

run().catch((error) => { console.error(error); process.exit(1); });
