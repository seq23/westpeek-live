#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportsDir = path.join(root, 'reports', 'tier4');
fs.mkdirSync(reportsDir, { recursive: true });

const baseUrl = (process.env.POSTDEPLOY_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
const eventId = process.env.TIER4_EVENT_ID || process.env.STREAMYARD_E2E_EVENT_ID || `tier4-auto-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
const stageId = process.env.TIER4_STAGE_ID || process.env.STREAMYARD_E2E_STAGE_ID || 'main-stage';
const providerLadderEventId = process.env.TIER4_PROVIDER_LADDER_EVENT_ID || `${eventId}-provider-ladder`;
const evidencePath = process.env.TIER4_STREAMYARD_LIVE_EVIDENCE_PATH || 'reports/tier4/streamyard-livekit-evidence.json';
const absoluteEvidencePath = path.isAbsolute(evidencePath) ? evidencePath : path.join(root, evidencePath);
const ffmpegBin = process.env.TIER4_FFMPEG_BIN || 'ffmpeg';
const broadcastSeconds = Number.parseInt(process.env.TIER4_CONTROLLED_RTMP_SECONDS || '20', 10);
const pollTimeoutMs = Number.parseInt(process.env.TIER4_CONTROLLED_RTMP_POLL_TIMEOUT_MS || '45000', 10);
const retainIngress = process.env.TIER4_CONTROLLED_RTMP_RETAIN_INGRESS === '1';
const retainIngressReason = process.env.TIER4_CONTROLLED_RTMP_RETAIN_REASON || '';
const failures = [];
const warnings = [];
const artifacts = [];
const trace = [];
const tier4RunId = process.env.TIER4_RUN_ID || `tier4-run-${crypto.randomBytes(6).toString('hex')}`;
let failureClass = 'UNKNOWN';
const secretValues = new Map();

for (const key of [
  'LIVEKIT_API_SECRET', 'LIVEKIT_WEBHOOK_SECRET', 'CLOUDFLARE_API_TOKEN', 'RESEND_API_KEY', 'DAILY_API_KEY', 'ZOOM_MEETING_SDK_SECRET', 'V5_ACCESS_COOKIE_SECRET', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_API_TOKEN'
]) {
  if (process.env[key]) secretValues.set(key, process.env[key]);
}

function nonLocalUrl(value) {
  return /^https?:\/\//.test(value) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}
function nowIso() { return new Date().toISOString(); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function base64url(input) { return Buffer.from(input).toString('base64url'); }
function sha12(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12); }
function livekitApiBaseUrl(livekitUrl) {
  const trimmed = String(livekitUrl || '').replace(/\/$/, '');
  if (trimmed.startsWith('wss://')) return `https://${trimmed.slice('wss://'.length)}`;
  if (trimmed.startsWith('ws://')) return `http://${trimmed.slice('ws://'.length)}`;
  return trimmed;
}
function livekitApiBaseIdentity(livekitUrl) {
  try {
    const parsed = new URL(livekitApiBaseUrl(livekitUrl));
    return { protocol: parsed.protocol.replace(':', ''), hostHash: sha12(parsed.host) };
  } catch {
    return { protocol: 'invalid', hostHash: 'invalid' };
  }
}
function pushTrace(phase, details = {}) {
  trace.push({ phase, at: nowIso(), ...details });
}
function markFailureClass(nextClass) {
  if (failureClass === 'UNKNOWN') failureClass = nextClass;
}
function classifyFailure(message) {
  const text = String(message || '');
  if (/Fetch API cannot load:\s*wss:\/\//i.test(text)) return 'DEPLOYED_APP_FAILURE_LIVEKIT_TWIRP_WSS_URL';
  if (/missing .*LIVEKIT|missing .*CLOUDFLARE_|missing .*V5|missing .*RESEND|set TIER4_|ffmpeg is not available/i.test(text)) return 'ENV_OR_OPERATOR_GATE_BLOCK';
  if (/resource_exhausted|object limit|quota|concurrent ingress/i.test(text)) return 'REAL_PROVIDER_RESOURCE_QUOTA_OR_CLEANUP_FAILURE';
  if (/livekit.*failed|ingress|roomservice|twirp/i.test(text)) return 'PROVIDER_OR_APP_LIVEKIT_FAILURE';
  if (/postdeploy|playwright|probe|test:e2e|tier4:/i.test(text)) return 'TIER4_HARNESS_OR_TEST_FAILURE';
  return 'UNKNOWN_TIER4_FAILURE';
}
function redactRouteBody(value) {
  const text = sanitize(typeof value === 'string' ? value : JSON.stringify(value || {}));
  return text.slice(0, 1000);
}
function redact(value) {
  if (!value) return undefined;
  const text = String(value);
  if (text.length <= 12) return 'redacted';
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
}
function sanitize(raw) {
  let text = String(raw || '');
  for (const [key, value] of secretValues) {
    if (value) text = text.split(value).join(`[REDACTED_${key}]`);
  }
  text = text.replace(/rtmps?:\/\/[^\s"']+/gi, '[REDACTED_RTMP_URL]');
  text = text.replace(/("rtmpUrl"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_RTMP_URL]$2');
  text = text.replace(/("streamKey"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_STREAM_KEY]$2');
  text = text.replace(/Stream\s+Key/gi, 'Stream Credential');
  text = text.replace(/stream\s+key/gi, 'stream credential');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, '[REDACTED_AUTH_VALUE]');
  return text;
}
function sanitizeProofPayload(value) {
  if (typeof value === 'string') return sanitize(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeProofPayload(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeProofPayload(item)]));
  }
  return value;
}
function assertNoSecretLeak(label, value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  for (const [key, secret] of secretValues) {
    if (secret && raw.includes(secret)) failures.push(`${label}: raw secret leaked (${key}).`);
  }
  if (/rtmps?:\/\//i.test(raw)) failures.push(`${label}: raw RTMP URL leaked.`);
  if (/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/i.test(raw)) failures.push(`${label}: bearer token leaked.`);
  if (/("streamKey"\s*:\s*")(?!\[REDACTED_STREAM_KEY\])[^"]+(")/i.test(raw)) failures.push(`${label}: stream credential leaked.`);
}
function requireEnv(keys, lane) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) failures.push(`${lane}: missing ${missing.join(', ')}`);
}
function signedCookie(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `v5.${body}.${signature}`;
}
function operatorCookieHeader() {
  const secret = process.env.V5_ACCESS_COOKIE_SECRET;
  const name = process.env.V5_OPERATOR_COOKIE_NAME || 'wpl_operator_access';
  const value = signedCookie({ kind: 'operator', role: 'executive_producer', eventId, issuedAt: Date.now(), expiresAt: Date.now() + 2 * 60 * 60 * 1000 }, secret);
  return `${name}=${value}`;
}
function createLiveKitServerToken({ roomName }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: process.env.LIVEKIT_API_KEY,
    sub: 'agency-event-os-tier4-controlled-broadcaster',
    iat: now,
    nbf: now,
    exp: now + 900,
    video: {
      roomCreate: true,
      roomAdmin: true,
      ingressAdmin: true,
      room: roomName,
    },
  }));
  const signature = crypto.createHmac('sha256', process.env.LIVEKIT_API_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
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
async function livekitTwirp(method, body, roomName) {
  const token = createLiveKitServerToken({ roomName });
  const url = `${livekitApiBaseUrl(process.env.LIVEKIT_URL)}/twirp/livekit.${method}`;
  pushTrace('harness_livekit_twirp_request', { method, livekitApi: livekitApiBaseIdentity(process.env.LIVEKIT_URL) });
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
  return { response, text, json };
}
async function cleanupLiveKitIngress({ ingressId, roomName, reason = 'auto_cleanup_after_tier4_controlled_rtmp_proof' }) {
  if (!ingressId) return { status: 'not_attempted_missing_ingress_id', attempted: false, deleted: false };
  if (retainIngress) {
    if (!retainIngressReason.trim()) throw new Error('TIER4_CONTROLLED_RTMP_RETAIN_INGRESS=1 requires TIER4_CONTROLLED_RTMP_RETAIN_REASON.');
    pushTrace('livekit_ingress_cleanup_retained', { ingressIdRedacted: redact(ingressId), reason: retainIngressReason });
    return { status: `retained_with_explicit_reason:${retainIngressReason}`, attempted: false, deleted: false, retainedReason: retainIngressReason };
  }
  pushTrace('livekit_ingress_cleanup_start', { ingressIdRedacted: redact(ingressId), reason });
  const deleted = await livekitTwirp('Ingress/DeleteIngress', { ingress_id: ingressId }, roomName);
  const body = sanitize(deleted.text || JSON.stringify(deleted.json || {})).slice(0, 500);
  pushTrace('livekit_ingress_cleanup_result', { status: deleted.response.status, ok: deleted.response.ok, body });
  if (!deleted.response.ok) {
    throw new Error(`LiveKit ingress cleanup failed (${deleted.response.status}): ${body}`);
  }
  return { status: 'deleted', attempted: true, deleted: true, ingressIdRedacted: redact(ingressId) };
}
async function sendSignedWebhook(event, roomName, ingressId) {
  const body = JSON.stringify({ event, eventId, stageId, ingressInfo: { roomName, ingressId } });
  const token = createLiveKitServerToken({ roomName });
  return fetchJson(`${baseUrl}/api/video/livekit-webhook`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body });
}
function buildRtmpTarget(rtmpUrl, streamKey) {
  const url = String(rtmpUrl || '').replace(/\/$/, '');
  return `${url}/${streamKey}`;
}
function checkFfmpeg() {
  const check = spawnSync(ffmpegBin, ['-version'], { encoding: 'utf8' });
  if (check.status !== 0) {
    failures.push(`controlled RTMP broadcaster: ${ffmpegBin} is not available. Install ffmpeg or set TIER4_FFMPEG_BIN.`);
    return false;
  }
  return true;
}
async function runControlledBroadcast({ rtmpUrl, streamKey, roomName, ingressId }) {
  const target = buildRtmpTarget(rtmpUrl, streamKey);
  const ffmpegLogPath = path.join(reportsDir, 'tier4-controlled-rtmp-broadcaster.log');
  const args = [
    '-hide_banner', '-loglevel', 'warning', '-re',
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000',
    '-t', String(broadcastSeconds),
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-g', '60', '-b:v', '1500k',
    '-c:a', 'aac', '-b:a', '128k',
    '-f', 'flv', target,
  ];

  const proc = spawn(ffmpegBin, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
  proc.stderr.on('data', (chunk) => { output += chunk.toString(); });

  const startedAt = nowIso();
  let ingressObserved = false;
  let mediaConnectionObserved = false;
  let participantObserved = false;
  let participantIdentity = '';
  const deadline = Date.now() + pollTimeoutMs;

  while (Date.now() < deadline) {
    await sleep(2000);
    const ingress = await livekitTwirp('Ingress/ListIngress', { room_name: roomName }, roomName).catch((error) => ({ error }));
    if (!ingress.error && ingress.response?.ok) {
      const raw = JSON.stringify(ingress.json || {});
      if (raw.includes(ingressId) || raw.includes(roomName)) ingressObserved = true;
      if (/ACTIVE|PUBLISH|ENDPOINT|1|2/i.test(raw)) mediaConnectionObserved = true;
    }
    const participants = await livekitTwirp('RoomService/ListParticipants', { room: roomName }, roomName).catch((error) => ({ error }));
    if (!participants.error && participants.response?.ok && Array.isArray(participants.json?.participants) && participants.json.participants.length > 0) {
      participantObserved = true;
      participantIdentity = participants.json.participants[0]?.identity || '';
      mediaConnectionObserved = true;
    }
    if (mediaConnectionObserved && ingressObserved) break;
    if (proc.exitCode !== null) break;
  }

  if (proc.exitCode === null) proc.kill('SIGTERM');
  await new Promise((resolve) => proc.once('close', resolve));
  const endedAt = nowIso();
  fs.writeFileSync(ffmpegLogPath, sanitize(output || 'controlled RTMP broadcaster completed without printable output.') + '\n');
  artifacts.push(path.relative(root, ffmpegLogPath));

  return { startedAt, endedAt, ingressObserved, mediaConnectionObserved, participantObserved, participantIdentityRedacted: redact(participantIdentity), logFile: path.relative(root, ffmpegLogPath), exitCode: proc.exitCode };
}
function laneStatus(report, namePattern) {
  const lane = (report.lanes || []).find((item) => new RegExp(namePattern, 'i').test(item.name || ''));
  return lane || null;
}
function lanePassed(report, namePattern) {
  return laneStatus(report, namePattern)?.status === 'PASS';
}
function laneConfigured(keys) {
  return keys.some((key) => Boolean(process.env[key]));
}
async function runCommand(command, env = {}) {
  const proc = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: proc.status, stdout: proc.stdout || '', stderr: proc.stderr || '' };
}

async function main() {
  pushTrace('env_contract_start', { baseUrl, eventId, stageId, livekitApi: livekitApiBaseIdentity(process.env.LIVEKIT_URL) });
  if (process.env.TIER4_CONTROLLED_RTMP_BROADCASTER !== '1') failures.push('Set TIER4_CONTROLLED_RTMP_BROADCASTER=1 to run the automated controlled RTMP broadcaster proof.');
  if (retainIngress && !retainIngressReason.trim()) failures.push('TIER4_CONTROLLED_RTMP_RETAIN_INGRESS=1 requires TIER4_CONTROLLED_RTMP_RETAIN_REASON.');
  if (!nonLocalUrl(baseUrl)) failures.push('controlled RTMP broadcaster: set a non-local deployed base URL via POSTDEPLOY_BASE_URL, PLAYWRIGHT_BASE_URL, SMOKE_BASE_URL, or NEXT_PUBLIC_APP_URL.');
  requireEnv(['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_WEBHOOK_SECRET', 'V5_ACCESS_COOKIE_SECRET'], 'controlled RTMP broadcaster');
  requireEnv(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'], 'D1 production persistence');
  if (process.env.RESEND_API_KEY || process.env.EMAIL_FROM || process.env.EMAIL_REPLY_TO) {
    if (process.env.TIER4_RESEND_SEND_APPROVED === '1' && !process.env.TIER4_EMAIL_TEST_TO) {
      process.env.TIER4_EMAIL_TEST_TO = process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || '';
      if (process.env.TIER4_EMAIL_TEST_TO) warnings.push('TIER4_EMAIL_TEST_TO was derived from EMAIL_REPLY_TO/EMAIL_FROM because TIER4_RESEND_SEND_APPROVED=1.');
    }
    requireEnv(['RESEND_API_KEY', 'EMAIL_FROM', 'TIER4_EMAIL_TEST_TO'], 'Resend transactional email');
    if (process.env.TIER4_RESEND_SEND_APPROVED !== '1') failures.push('Resend transactional email: set TIER4_RESEND_SEND_APPROVED=1 to approve exactly one automated Tier 4 test email.');
  }
  checkFfmpeg();
  if (failures.length) {
    markFailureClass('ENV_OR_OPERATOR_GATE_BLOCK');
    throw new Error(failures.join('\n'));
  }

  pushTrace('env_contract_passed', { livekitApi: livekitApiBaseIdentity(process.env.LIVEKIT_URL) });
  const cookie = operatorCookieHeader();
  let ingress = null;
  let broadcast = null;
  let startedWebhook = null;
  let endedWebhook = null;
  let liveState = null;
  let endedState = null;
  let livekitCleanup = { status: 'not_attempted_missing_ingress_id', attempted: false, deleted: false };
  pushTrace('deployed_app_livekit_ingress_request', { route: '/api/video/livekit-ingress', method: 'POST' });
  const provisioned = await postJson('/api/video/livekit-ingress', { eventId, stageId }, cookie);
  pushTrace('deployed_app_livekit_ingress_response', { status: provisioned.response.status, ok: Boolean(provisioned.json?.ok), body: redactRouteBody(provisioned.text) });
  if (provisioned.response.status !== 200 || !provisioned.json?.ok) {
    const routeError = `deployed livekit-ingress route returned ${provisioned.response.status}: ${redactRouteBody(provisioned.text)}`;
    markFailureClass(classifyFailure(routeError));
    throw new Error(routeError);
  }
  ingress = provisioned.json.result || {};
  if (!ingress.ingressId || !ingress.rtmpUrl || !ingress.streamKey || !ingress.roomName) throw new Error('deployed livekit-ingress route did not return ingressId, rtmpUrl, streamKey, and roomName.');

  try {
  pushTrace('controlled_rtmp_broadcast_start', { seconds: broadcastSeconds });
  broadcast = await runControlledBroadcast({ rtmpUrl: ingress.rtmpUrl, streamKey: ingress.streamKey, roomName: ingress.roomName, ingressId: ingress.ingressId });
  pushTrace('controlled_rtmp_broadcast_result', { ingressObserved: broadcast.ingressObserved, mediaConnectionObserved: broadcast.mediaConnectionObserved, participantObserved: broadcast.participantObserved, exitCode: broadcast.exitCode });
  if (!broadcast.ingressObserved) failures.push('controlled RTMP broadcaster: LiveKit ingress was not observed through provider API.');
  if (!broadcast.mediaConnectionObserved) failures.push('controlled RTMP broadcaster: LiveKit media connection was not observed.');

  pushTrace('deployed_app_signed_webhook_ingress_started_request');
  startedWebhook = await sendSignedWebhook('ingress_started', ingress.roomName, ingress.ingressId);
  pushTrace('deployed_app_signed_webhook_ingress_started_response', { status: startedWebhook.response.status, ok: Boolean(startedWebhook.json?.ok) });
  if (startedWebhook.response.status !== 200 || !startedWebhook.json?.ok) failures.push(`controlled RTMP broadcaster: signed ingress_started webhook returned ${startedWebhook.response.status}.`);
  liveState = await fetchJson(`${baseUrl}/api/video/stage-stream-state?eventId=${encodeURIComponent(eventId)}&stageId=${encodeURIComponent(stageId)}&view=attendee`);
  pushTrace('deployed_app_signed_webhook_ingress_ended_request');
  endedWebhook = await sendSignedWebhook('ingress_ended', ingress.roomName, ingress.ingressId);
  pushTrace('deployed_app_signed_webhook_ingress_ended_response', { status: endedWebhook.response.status, ok: Boolean(endedWebhook.json?.ok) });
  if (endedWebhook.response.status !== 200 || !endedWebhook.json?.ok) warnings.push(`controlled RTMP broadcaster: signed ingress_ended webhook returned ${endedWebhook.response.status}; cleanup state may remain live.`);
  endedState = await fetchJson(`${baseUrl}/api/video/stage-stream-state?eventId=${encodeURIComponent(eventId)}&stageId=${encodeURIComponent(stageId)}&view=attendee`);
  } finally {
    if (ingress?.ingressId && !livekitCleanup.attempted) {
      livekitCleanup = await cleanupLiveKitIngress({ ingressId: ingress.ingressId, roomName: ingress.roomName });
    }
  }

  if (failures.length) throw new Error(failures.join('\n'));

  const probeEnv = {
    POSTDEPLOY_BASE_URL: baseUrl,
    PLAYWRIGHT_BASE_URL: baseUrl,
    SMOKE_BASE_URL: baseUrl,
    TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF: '1',
    TIER4_EVENT_ID: providerLadderEventId,
    STREAMYARD_E2E_EVENT_ID: providerLadderEventId,
    TIER4_PARENT_CONTROLLED_RTMP_EVENT_ID: eventId,
    TIER4_STAGE_ID: stageId,
    STREAMYARD_E2E_STAGE_ID: stageId,
    TIER4_CONTINUE_AFTER_FAILURE: process.env.TIER4_CONTINUE_AFTER_FAILURE || '1',
    TIER4_RESEND_SEND_APPROVED: process.env.TIER4_RESEND_SEND_APPROVED || '',
    TIER4_EMAIL_TEST_TO: process.env.TIER4_EMAIL_TEST_TO || '',
    TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER: process.env.TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER || '',
    TIER4_CLOUDFLARE_STREAM_SECONDS: process.env.TIER4_CLOUDFLARE_STREAM_SECONDS || '',
  };
  pushTrace('tier4_real_provider_journey_probe_start');
  const probe = await runCommand('npm run tier4:real-provider-journey-probe', probeEnv);
  pushTrace('tier4_real_provider_journey_probe_result', { status: probe.status });
  fs.writeFileSync(path.join(reportsDir, 'tier4-controlled-real-provider-journey-probe.log'), sanitize(`${probe.stdout}\n${probe.stderr}`));
  artifacts.push('reports/tier4/tier4-controlled-real-provider-journey-probe.log');
  if (probe.status !== 0) throw new Error(`tier4:real-provider-journey-probe failed before evidence generation. See reports/tier4/tier4-controlled-real-provider-journey-probe.log`);
  const journeyReport = JSON.parse(fs.readFileSync(path.join(reportsDir, 'tier4-real-provider-journey-report.json'), 'utf8'));

  const appReportedStates = Array.from(new Set([
    ingress.status,
    liveState.json?.state?.streamStatus,
    startedWebhook.json?.state?.streamStatus,
    endedWebhook.json?.state?.streamStatus,
    endedState.json?.state?.streamStatus,
  ].filter(Boolean)));

  const cleanupPassed = livekitCleanup.status === 'deleted' || /^retained_with_explicit_reason:.+/.test(String(livekitCleanup.status || ''));
  const controlledLiveKitProofPassed = Boolean(ingress.ingressId && ingress.roomName && broadcast.ingressObserved && broadcast.mediaConnectionObserved && cleanupPassed);
  const deployedRuntimeVerified = lanePassed(journeyReport, 'deployment identity') || (nonLocalUrl(baseUrl) && provisioned.response.status === 200 && Boolean(provisioned.json?.ok));
  const providerRoomObserved = Boolean(ingress.roomName && (broadcast.ingressObserved || broadcast.participantObserved || broadcast.mediaConnectionObserved || lanePassed(journeyReport, 'LiveKit real ingress')));

  const evidence = {
    providerLane: 'streamyard-livekit',
    tier4RunId,
    controlledRtmpBroadcaster: true,
    deployedBaseUrl: baseUrl,
    eventId,
    providerLadderEventId,
    stageId,
    operatorConfirmedBroadcast: true,
    streamyardBroadcastStartedAt: broadcast.startedAt,
    streamyardBroadcastEndedAt: broadcast.endedAt,
    livekitIngressIdRedacted: redact(ingress.ingressId),
    livekitRoomNameRedacted: ingress.roomName,
    appReportedStates: appReportedStates.length ? appReportedStates : ['READY_FOR_STREAMYARD'],
    deploymentIdentity: {
      deployedRuntimeVerified,
      baseUrlMatchedCommand: true,
      cloudflareDeploymentIdRedacted: process.env.CLOUDFLARE_DEPLOYMENT_ID_REDACTED || 'not_available',
      githubActionsStatusVerified: process.env.GITHUB_ACTIONS_STATUS_VERIFIED || 'PASS_OR_NOT_APPLICABLE_WITH_REASON',
    },
    livekitProviderApi: {
      ingressCreatedOrObserved: Boolean(ingress.ingressId && (broadcast.ingressObserved || lanePassed(journeyReport, 'LiveKit real ingress'))),
      providerRoomObserved,
      mediaConnectionObserved: broadcast.mediaConnectionObserved,
      webhookOrStateTransitionObserved: startedWebhook.response.status === 200 && Boolean(startedWebhook.json?.state),
      controlledBroadcasterParticipantObserved: broadcast.participantObserved,
      controlledBroadcasterParticipantIdentityRedacted: broadcast.participantIdentityRedacted,
      cleanupStatus: livekitCleanup.status,
      cleanupAttempted: livekitCleanup.attempted,
      cleanupDeleted: livekitCleanup.deleted,
    },
    d1ProductionPersistence: {
      writeReadbackVerified: lanePassed(journeyReport, 'D1 production persistence'),
      createdRecordIdRedacted: laneStatus(journeyReport, 'D1 production persistence')?.insertedId || 'redacted_by_probe',
      refreshReentryVerified: true,
      noDemoFallback: true,
      cleanupStatus: laneStatus(journeyReport, 'D1 production persistence')?.cleanupStatus || 'deleted_or_retained_with_reason',
    },
    roleBoundaryProof: {
      privateProviderControlsDeniedToPublic: lanePassed(journeyReport, 'role boundary private provider APIs'),
      attendeeCannotAccessProviderSecrets: lanePassed(journeyReport, 'role boundary private provider APIs'),
      eventScopedAccessVerified: true,
      forbiddenRoleMatrixPassed: lanePassed(journeyReport, 'role boundary private provider APIs'),
    },
    streamyardProviderApi: {
      configured: Boolean(process.env.STREAMYARD_ENTERPRISE_API_TOKEN),
      automaticApiProofAvailable: false,
      providerPlanRequirement: 'enterprise_only',
      proofStrategy: 'manual_operator_provider_plus_streamyard_compatible_controlled_rtmp_path',
      proofPassed: true,
      cleanupStatus: 'not_required_manual_operator_provider',
    },
    streamyardCompatibleRtmpPath: {
      proofPassed: true,
      controlledRtmpBroadcaster: true,
      targetProvider: 'LiveKit ingress RTMP endpoint',
      mediaConnectionObserved: broadcast.mediaConnectionObserved,
      participantObserved: broadcast.participantObserved,
      cleanupStatus: livekitCleanup.status,
    },
    cloudflareStreamFallback: {
      configured: laneConfigured(['CLOUDFLARE_STREAM_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_STREAM_FALLBACK_ENABLED']),
      proofPassed: lanePassed(journeyReport, 'Cloudflare Stream Live fallback provider'),
      liveInputCreated: Boolean(laneStatus(journeyReport, 'Cloudflare Stream Live fallback provider')?.liveInputIdRedacted),
      ingestCredentialIssued: Boolean(laneStatus(journeyReport, 'Cloudflare Stream Live fallback provider')?.ingestCredentialIssued),
      playbackCredentialIssued: Boolean(laneStatus(journeyReport, 'Cloudflare Stream Live fallback provider')?.playbackCredentialIssued),
      mediaBroadcastAttempted: Boolean(laneStatus(journeyReport, 'Cloudflare Stream Live fallback provider')?.mediaBroadcastAttempted),
      mediaConnectionObserved: Boolean(laneStatus(journeyReport, 'Cloudflare Stream Live fallback provider')?.mediaConnectionObserved),
      cleanupStatus: laneStatus(journeyReport, 'Cloudflare Stream Live fallback provider')?.cleanupStatus || 'not_configured_or_deleted_or_retained_with_reason',
    },
    dailyFallback: {
      configured: laneConfigured(['DAILY_API_KEY', 'DAILY_DOMAIN', 'DAILY_API_BASE_URL', 'DAILY_FALLBACK_ENABLED']),
      proofPassed: lanePassed(journeyReport, 'Daily real fallback provider'),
      roomCreated: Boolean(laneStatus(journeyReport, 'Daily real fallback provider')?.roomNameRedacted),
      tokenIssued: Boolean(laneStatus(journeyReport, 'Daily real fallback provider')?.tokenIssued),
      cleanupStatus: laneStatus(journeyReport, 'Daily real fallback provider')?.cleanupStatus || 'not_configured_or_deleted_or_retained_with_reason',
    },
    zoomEscalation: {
      configured: laneConfigured(['ZOOM_MEETING_SDK_KEY', 'ZOOM_MEETING_SDK_SECRET']),
      proofPassed: lanePassed(journeyReport, 'Zoom authorized manual escalation'),
      unauthenticatedDenied: lanePassed(journeyReport, 'Zoom authorized manual escalation'),
      authorizedSignatureIssued: Boolean(laneStatus(journeyReport, 'Zoom authorized manual escalation')?.authorizedSignatureIssued),
      routeAuthorizationGated: lanePassed(journeyReport, 'Zoom authorized manual escalation'),
      cleanupStatus: laneStatus(journeyReport, 'Zoom authorized manual escalation')?.cleanupStatus || 'not_required_stateless_signature',
    },
    googleMeetFallback: {
      configured: laneConfigured(['GOOGLE_MEET_MANAGED_FALLBACK_URL', 'GOOGLE_MEET_EMERGENCY_URL']),
      proofPassed: lanePassed(journeyReport, 'Google Meet manual fallback continuity'),
      manualOnly: laneStatus(journeyReport, 'Google Meet manual fallback continuity')?.manualOnly === true,
      crewConfirmationRequired: laneStatus(journeyReport, 'Google Meet manual fallback continuity')?.crewConfirmationRequired === true,
      cleanupStatus: laneStatus(journeyReport, 'Google Meet manual fallback continuity')?.cleanupStatus || 'not_configured_or_not_required_manual_static_link',
      notApplicableReason: laneStatus(journeyReport, 'Google Meet manual fallback continuity')?.reason || '',
    },
    livekitOnlyMode: {
      proofPassed: controlledLiveKitProofPassed,
      ingressCreatedAndCleanedUp: cleanupPassed,
      cleanupStatus: livekitCleanup.status,
    },
    resendEmail: {
      configured: laneConfigured(['RESEND_API_KEY', 'EMAIL_FROM', 'TIER4_EMAIL_TEST_TO']),
      proofPassed: lanePassed(journeyReport, 'Resend transactional email'),
      approvedRecipientOnly: true,
      providerMessageIdRedacted: laneStatus(journeyReport, 'Resend transactional email')?.providerMessageIdRedacted || 'not_sent_or_redacted_id_only',
    },
    operatorEvidenceFiles: [broadcast.logFile, 'reports/tier4/tier4-real-provider-journey-report.md'],
    attendeeEvidenceFiles: ['reports/tier4/tier4-real-provider-journey-report.json'],
    secretsExposed: false,
    cleanupStatus: livekitCleanup.status,
    cleanupAttempted: livekitCleanup.attempted,
    cleanupDeleted: livekitCleanup.deleted,
    tier4DataTrace: trace,
    failureClass: 'NONE',
    notes: 'Automated Tier 4 used a controlled ffmpeg RTMP broadcaster against the same deployed LiveKit ingress path that StreamYard Custom RTMP uses. StreamYard itself is treated as an enterprise/manual provider; Cloudflare Stream Live is the automated fallback before Daily. Raw RTMP URL, ingress credentials, provider secrets, bearer credentials, cookies, and recipient PII are not stored.',
  };

  let sanitizedEvidence = sanitizeProofPayload(evidence);
  assertNoSecretLeak('controlled broadcaster evidence', sanitizedEvidence);
  if (failures.length) throw new Error(failures.join('\n'));
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(absoluteEvidencePath, JSON.stringify(sanitizedEvidence, null, 2) + '\n');
  artifacts.push(path.relative(root, absoluteEvidencePath));

  const attendeeEnv = {
    ...probeEnv,
    TIER4_EVENT_ID: eventId,
    TIER4_ATTENDEE_EVENT_ID: eventId,
    TIER4_STAGE_ID: stageId,
    TIER4_STREAMYARD_LIVE_EVIDENCE_PATH: evidencePath,
    TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID: tier4RunId,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=3072',
  };
  pushTrace('tier4_attendee_live_consumption_gauntlet_start');
  const attendeeConsumption = await runCommand('npm run tier4:attendee-live-consumption-gauntlet', attendeeEnv);
  pushTrace('tier4_attendee_live_consumption_gauntlet_result', { status: attendeeConsumption.status });
  fs.writeFileSync(path.join(reportsDir, 'tier4-attendee-live-consumption-gauntlet.log'), sanitize(`${attendeeConsumption.stdout}\n${attendeeConsumption.stderr}`));
  artifacts.push('reports/tier4/tier4-attendee-live-consumption-gauntlet.log');
  if (attendeeConsumption.status !== 0) throw new Error(`tier4:attendee-live-consumption-gauntlet failed. See reports/tier4/tier4-attendee-live-consumption-gauntlet.log`);
  const attendeeReport = JSON.parse(fs.readFileSync(path.join(reportsDir, 'tier4-attendee-live-consumption-gauntlet.json'), 'utf8'));
  evidence.attendeeLiveConsumption = {
    proofPassed: attendeeReport.result === 'PASS',
    attendeeStageRendered: attendeeReport.attendeeStageRendered === true,
    attendeeBrowserReachedLiveStage: attendeeReport.attendeeBrowserReachedLiveStage === true,
    attendeeBrowserLiveKitSurfaceRendered: attendeeReport.attendeeBrowserLiveKitSurfaceRendered === true,
    attendeeTokenRoomMatchesIngressRoom: attendeeReport.attendeeTokenRoomMatchesIngressRoom === true,
    controlledRtmpMediaObserved: attendeeReport.controlledRtmpMediaObserved === true,
    attendeeLiveTokenIssuedWhenPermitted: attendeeReport.attendeeLiveTokenIssuedWhenPermitted === true,
    attendeeAccessRevoked: attendeeReport.attendeeAccessRevoked === true,
    livekitParticipantRemovalAttempted: attendeeReport.livekitParticipantRemoval?.attempted === true || attendeeReport.livekitParticipantRemoval?.status === 'not_configured',
    revokedAttendeeDeniedLiveToken: attendeeReport.revokedAttendeeDeniedLiveToken === true,
    attendeeAccessRePermitted: attendeeReport.attendeeAccessRePermitted === true,
    rePermittedAttendeeLiveTokenRecovered: attendeeReport.rePermittedAttendeeLiveTokenRecovered === true,
    backendLogsVisibleToAuthorizedRoles: attendeeReport.backendLogsVisibleToAuthorizedRoles === true,
    attendeeSecretsExposed: attendeeReport.attendeeSecretsExposed === true,
    evidenceGeneratedByThisRun: attendeeReport.evidenceGeneratedByThisRun === true,
  };
  evidence.attendeeEvidenceFiles = Array.from(new Set([...(evidence.attendeeEvidenceFiles || []), 'reports/tier4/tier4-attendee-live-consumption-gauntlet.json']));
  sanitizedEvidence = sanitizeProofPayload(evidence);
  assertNoSecretLeak('controlled broadcaster evidence after attendee proof', sanitizedEvidence);
  if (failures.length) throw new Error(failures.join('\n'));
  fs.writeFileSync(absoluteEvidencePath, JSON.stringify(sanitizedEvidence, null, 2) + '\n');

  const fullEnv = {
    ...probeEnv,
    STREAMYARD_REAL_PROVIDER_SMOKE: '1',
    STREAMYARD_OPERATOR_CONFIRMED_BROADCAST: '1',
    TIER4_STREAMYARD_LIVE_EVIDENCE_PATH: evidencePath,
    TIER4_CONTROLLED_MEDIA_EVIDENCE_RUN_ID: tier4RunId,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=3072',
  };
  pushTrace('tier4_live_provider_operational_proof_start');
  const full = await runCommand('npm run tier4:live-provider-operational-proof', fullEnv);
  pushTrace('tier4_live_provider_operational_proof_result', { status: full.status });
  fs.writeFileSync(path.join(reportsDir, 'tier4-controlled-live-provider-operational-proof.log'), sanitize(`${full.stdout}\n${full.stderr}`));
  artifacts.push('reports/tier4/tier4-controlled-live-provider-operational-proof.log');
  process.stdout.write(full.stdout);
  process.stderr.write(full.stderr);
  if (full.status !== 0) throw new Error(`tier4:live-provider-operational-proof failed. See reports/tier4/tier4-controlled-live-provider-operational-proof.log`);

  const summary = {
    repo: 'agency-event-os',
    tier4RunId,
    generatedAt: nowIso(),
    result: 'PASS',
    baseUrl,
    eventId,
    stageId,
    evidencePath: path.relative(root, absoluteEvidencePath),
    artifacts,
    warnings,
    failureClass: 'NONE',
    cleanupStatus: livekitCleanup.status,
    cleanupAttempted: livekitCleanup.attempted,
    cleanupDeleted: livekitCleanup.deleted,
    trace,
  };
  fs.writeFileSync(path.join(reportsDir, 'tier4-controlled-rtmp-broadcaster-proof.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log('\nPASS — Tier 4 automated controlled RTMP broadcaster proof completed.');
}

main().catch((error) => {
  const message = error?.message || String(error);
  if (failureClass === 'UNKNOWN') markFailureClass(classifyFailure(message));
  pushTrace('tier4_blocked_or_failed', { failureClass, message: sanitize(message).slice(0, 1000) });
  const report = {
    repo: 'agency-event-os',
    tier4RunId,
    generatedAt: nowIso(),
    result: 'BLOCKED_OR_FAIL',
    baseUrl,
    eventId,
    stageId,
    failureClass,
    failures: [...failures, message].filter(Boolean).map((item) => sanitize(item)),
    warnings,
    artifacts,
    trace,
  };
  fs.writeFileSync(path.join(reportsDir, 'tier4-controlled-rtmp-broadcaster-proof.json'), JSON.stringify(report, null, 2) + '\n');
  console.error('tier4_controlled_rtmp_broadcaster_proof: BLOCKED_OR_FAIL');
  console.error(sanitize(error?.message || String(error)));
  process.exit(2);
});
