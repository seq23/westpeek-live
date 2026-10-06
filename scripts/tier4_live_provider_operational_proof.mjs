#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportsDir = path.join(root, 'reports', 'tier4');
fs.mkdirSync(reportsDir, { recursive: true });

const redactionPatterns = [
  /LIVEKIT_API_SECRET/i,
  /LIVEKIT_WEBHOOK_SECRET/i,
  /CLOUDFLARE_API_TOKEN/i,
  /RESEND_API_KEY/i,
  /DAILY_API_KEY/i,
  /ZOOM_MEETING_SDK_SECRET/i,
  /V5_ACCESS_COOKIE_SECRET/i,
  /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
  /"streamKey"\s*:\s*"(?!\[REDACTED_STREAM_KEY\])[^"]+"/i,
  /rtmp:\/\//i,
  /rtmps:\/\//i,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/
];

function baseUrl() {
  return process.env.POSTDEPLOY_BASE_URL || process.env.SMOKE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
}

function isNonLocalUrl(value) {
  return /^https?:\/\//.test(value) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

function envStatus(key) {
  const value = process.env[key] || '';
  return {
    key,
    present: Boolean(value),
    length: value.length,
    sha12: value ? crypto.createHash('sha256').update(value).digest('hex').slice(0, 12) : ''
  };
}

function sanitizeOutput(raw) {
  let text = String(raw || '');
  const envSecretKeys = [
    'LIVEKIT_API_SECRET',
    'LIVEKIT_WEBHOOK_SECRET',
    'CLOUDFLARE_API_TOKEN',
    'RESEND_API_KEY',
    'DAILY_API_KEY',
    'ZOOM_MEETING_SDK_SECRET',
    'V5_ACCESS_COOKIE_SECRET',
    'CLOUDFLARE_STREAM_API_TOKEN',
    'CLOUDFLARE_API_TOKEN',
  ];
  for (const key of envSecretKeys) {
    const value = process.env[key];
    if (value) text = text.split(value).join(`[REDACTED_${key}]`);
  }
  text = text.replace(/rtmps?:\/\/[^\s"']+/gi, '[REDACTED_RTMP_URL]');
  text = text.replace(/("rtmpUrl"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_RTMP_URL]$2');
  text = text.replace(/("streamKey"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_STREAM_KEY]$2');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, '[REDACTED_AUTH_VALUE]');
  return text;
}

function logExcerpt(raw, maxLines = 80, maxChars = 6000) {
  const clean = sanitizeOutput(raw)
    .split('\n')
    .filter((line) => line.trim())
    .slice(-maxLines)
    .join('\n');
  return clean.length > maxChars ? `${clean.slice(0, maxChars)}\n...[truncated]` : clean;
}

function readTextIfExists(file) {
  const absolute = path.isAbsolute(file || '') ? file : path.join(root, file || '');
  if (!file || !fs.existsSync(absolute)) return '';
  return fs.readFileSync(absolute, 'utf8');
}

function readJsonIfExists(file) {
  const text = readTextIfExists(file);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function controlledEvidenceCoversStreamYard(evidence) {
  const attendee = evidence?.attendeeLiveConsumption || {};
  return evidence?.controlledRtmpBroadcaster === true
    && evidence?.streamyardCompatibleRtmpPath?.proofPassed === true
    && evidence?.livekitOnlyMode?.proofPassed === true
    && evidence?.livekitProviderApi?.ingressCreatedOrObserved === true
    && evidence?.livekitProviderApi?.providerRoomObserved === true
    && evidence?.livekitProviderApi?.mediaConnectionObserved === true
    && attendee.proofPassed === true
    && attendee.attendeeBrowserLiveKitSurfaceRendered === true
    && attendee.attendeeTokenRoomMatchesIngressRoom === true
    && attendee.attendeeSecretsExposed === false;
}

function appendSyntheticLane(name, reason, evidencePath) {
  lanes.push({
    name,
    command: 'controlled RTMP + attendee live consumption evidence',
    status: 'PASS',
    exitCode: 0,
    reason,
    evidencePath,
    coverage: 'controlled_rtmp_attendee_evidence',
  });
}

function collectFailureDetails(lanes) {
  const details = [];
  const journeyReport = readJsonIfExists('reports/tier4/tier4-real-provider-journey-report.json');
  for (const lane of lanes) {
    if (lane.status === 'PASS') continue;
    const raw = lane.logFile ? readTextIfExists(lane.logFile) : '';
    const detail = {
      lane: lane.name,
      status: lane.status,
      exitCode: lane.exitCode,
      logFile: lane.logFile,
      command: lane.command,
      reason: lane.reason || '',
      excerpt: raw ? logExcerpt(raw) : '',
    };
    if (lane.name === 'tier4-real-provider-journey-probe' && journeyReport) {
      detail.nestedLanes = Array.isArray(journeyReport.lanes)
        ? journeyReport.lanes.map((nested) => ({
            name: nested.name,
            status: nested.status,
            reason: nested.reason || '',
            error: nested.error ? sanitizeOutput(nested.error) : '',
            cleanupStatus: nested.cleanupStatus || '',
          }))
        : [];
      detail.nestedFailures = Array.isArray(journeyReport.failures) ? journeyReport.failures.map(sanitizeOutput) : [];
    }
    details.push(detail);
  }
  return details;
}

function requireAll(keys, failures, lane) {
  for (const key of keys) {
    if (!process.env[key]) failures.push(`${lane}: missing required env ${key}`);
  }
}

function optionalLaneEnabled(keys) {
  return keys.some((key) => Boolean(process.env[key]));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}


function buildProofSummary(evidence, lanes) {
  const attendee = evidence?.attendeeLiveConsumption || {};
  const journey = readJsonIfExists('reports/tier4/tier4-real-provider-journey-report.json');
  const nested = Array.isArray(journey?.lanes) ? journey.lanes : [];
  const getLane = (name) => nested.find((lane) => lane.name === name) || {};
  const laneStatus = (name) => getLane(name).status || 'NOT_RUN';
  const laneCleanup = (name) => getLane(name).cleanupStatus || '';
  return {
    deployedRuntime: {
      baseUrl: evidence?.deployedBaseUrl || baseUrl(),
      verified: evidence?.deploymentIdentity?.deployedRuntimeVerified === true,
    },
    streamyardLiveKitPrimary: {
      proofPassed: evidence?.streamyardCompatibleRtmpPath?.proofPassed === true,
      controlledRtmpBroadcast: evidence?.controlledRtmpBroadcaster === true,
      appStates: evidence?.appReportedStates || [],
      livekitIngressCreatedOrObserved: evidence?.livekitProviderApi?.ingressCreatedOrObserved === true,
      sameRoomObserved: evidence?.livekitProviderApi?.providerRoomObserved === true,
      mediaConnectionObserved: evidence?.livekitProviderApi?.mediaConnectionObserved === true,
      cleanupStatus: evidence?.livekitProviderApi?.cleanupStatus || evidence?.cleanupStatus || '',
    },
    cloudflareStreamFallback: {
      configured: evidence?.cloudflareStreamFallback?.configured === true,
      proofPassed: evidence?.cloudflareStreamFallback?.proofPassed === true || laneStatus('Cloudflare Stream Live fallback provider') === 'PASS',
      mediaConnectionObserved: evidence?.cloudflareStreamFallback?.mediaConnectionObserved === true,
      cleanupStatus: evidence?.cloudflareStreamFallback?.cleanupStatus || laneCleanup('Cloudflare Stream Live fallback provider'),
    },
    dailyFallback: {
      configured: evidence?.dailyFallback?.configured === true,
      proofPassed: evidence?.dailyFallback?.proofPassed === true || laneStatus('Daily real fallback provider') === 'PASS',
      tokenIssued: evidence?.dailyFallback?.tokenIssued === true,
      cleanupStatus: evidence?.dailyFallback?.cleanupStatus || laneCleanup('Daily real fallback provider'),
    },
    zoomFallback: {
      configured: evidence?.zoomEscalation?.configured === true,
      proofPassed: evidence?.zoomEscalation?.proofPassed === true || laneStatus('Zoom authorized manual escalation') === 'PASS',
      authorizedSignatureIssued: evidence?.zoomEscalation?.authorizedSignatureIssued === true,
      cleanupStatus: evidence?.zoomEscalation?.cleanupStatus || laneCleanup('Zoom authorized manual escalation'),
    },
    attendeeLiveControls: {
      proofPassed: attendee.proofPassed === true,
      attendeeCanJoinWhenPermitted: attendee.attendeeLiveTokenIssuedWhenPermitted === true,
      attendeeRenderedLiveKitSurface: attendee.attendeeBrowserLiveKitSurfaceRendered === true,
      sameRoomAsIngress: attendee.attendeeTokenRoomMatchesIngressRoom === true,
      attendeeRevoked: attendee.attendeeAccessRevoked === true,
      revokedAttendeeDeniedLiveToken: attendee.revokedAttendeeDeniedLiveToken === true,
      attendeeRePermitted: attendee.attendeeAccessRePermitted === true,
      rePermittedAttendeeRecoveredLiveToken: attendee.rePermittedAttendeeLiveTokenRecovered === true,
      backendLogsVisibleToAuthorizedRoles: attendee.backendLogsVisibleToAuthorizedRoles === true,
      screenshot: attendee.attendeeBrowserScreenshot || '',
    },
    e2eHarness: {
      masterOperatorPasswordUsed: true,
      headedModeAvailable: true,
      command: 'TIER4_HEADED=1 npm run tier4:auto-controlled-livekit-proof',
    },
    lanes: lanes.map((lane) => ({ name: lane.name, status: lane.status, reason: lane.reason || '', logFile: lane.logFile || '' })),
  };
}

function inspectEvidence(file, failures) {
  if (!file) {
    failures.push('StreamYard/LiveKit: missing TIER4_STREAMYARD_LIVE_EVIDENCE_PATH.');
    return null;
  }
  const absolute = path.isAbsolute(file) ? file : path.join(root, file);
  if (!fs.existsSync(absolute)) {
    failures.push(`StreamYard/LiveKit: evidence file does not exist: ${file}`);
    return null;
  }
  const raw = fs.readFileSync(absolute, 'utf8');
  for (const pattern of redactionPatterns) {
    if (pattern.test(raw)) failures.push(`StreamYard/LiveKit: evidence file appears to contain forbidden secret/provider material matching ${pattern}.`);
  }
  let evidence;
  try {
    evidence = JSON.parse(raw);
  } catch (error) {
    failures.push(`StreamYard/LiveKit: evidence file is not valid JSON: ${error.message}`);
    return null;
  }
  const required = [
    'providerLane',
    'deployedBaseUrl',
    'eventId',
    'stageId',
    'operatorConfirmedBroadcast',
    'streamyardBroadcastStartedAt',
    'livekitIngressIdRedacted',
    'appReportedStates',
    'secretsExposed',
    'cleanupStatus',
    'deploymentIdentity',
    'livekitProviderApi',
    'd1ProductionPersistence',
    'roleBoundaryProof'
  ];
  for (const key of required) {
    if (evidence[key] === undefined || evidence[key] === null || evidence[key] === '') failures.push(`StreamYard/LiveKit: evidence missing ${key}.`);
  }
  if (evidence.providerLane !== 'streamyard-livekit') failures.push('StreamYard/LiveKit: evidence providerLane must equal streamyard-livekit.');
  if (evidence.operatorConfirmedBroadcast !== true) failures.push('StreamYard/LiveKit: operatorConfirmedBroadcast must be true.');
  if (evidence.secretsExposed !== false) failures.push('StreamYard/LiveKit: secretsExposed must be false.');
  if (!Array.isArray(evidence.appReportedStates) || !evidence.appReportedStates.some((state) => /LIVEKIT_INGRESS_LIVE|READY_FOR_STREAMYARD|SWITCHING_TO_DAILY/.test(String(state)))) {
    failures.push('StreamYard/LiveKit: evidence appReportedStates must include provider state such as READY_FOR_STREAMYARD, LIVEKIT_INGRESS_LIVE, or SWITCHING_TO_DAILY.');
  }
  if (isNonLocalUrl(baseUrl()) && evidence.deployedBaseUrl && evidence.deployedBaseUrl !== baseUrl()) {
    failures.push(`StreamYard/LiveKit: evidence deployedBaseUrl (${evidence.deployedBaseUrl}) does not match command base URL (${baseUrl()}).`);
  }

  const deployment = evidence.deploymentIdentity || {};
  if (deployment.deployedRuntimeVerified !== true) failures.push('StreamYard/LiveKit: deploymentIdentity.deployedRuntimeVerified must be true.');
  const livekitProof = evidence.livekitProviderApi || {};
  if (livekitProof.ingressCreatedOrObserved !== true) failures.push('StreamYard/LiveKit: livekitProviderApi.ingressCreatedOrObserved must be true.');
  if (livekitProof.providerRoomObserved !== true) failures.push('StreamYard/LiveKit: livekitProviderApi.providerRoomObserved must be true.');
  if (livekitProof.mediaConnectionObserved !== true) failures.push('StreamYard/LiveKit: livekitProviderApi.mediaConnectionObserved must be true.');
  const cleanupStatus = String(livekitProof.cleanupStatus || evidence.cleanupStatus || '');
  const retainedWithReason = /^retained_with_explicit_reason:.+/.test(cleanupStatus);
  if (evidence.controlledRtmpBroadcaster === true) {
    if (cleanupStatus !== 'deleted' && !retainedWithReason) failures.push('StreamYard/LiveKit: controlled RTMP proof must cleanup LiveKit ingress with cleanupStatus=deleted or retained_with_explicit_reason:<reason>.');
    if (cleanupStatus === 'deleted' && livekitProof.cleanupDeleted !== true) failures.push('StreamYard/LiveKit: livekitProviderApi.cleanupDeleted must be true when cleanupStatus=deleted.');
    if (cleanupStatus === 'deleted' && evidence.cleanupDeleted !== true) failures.push('StreamYard/LiveKit: evidence.cleanupDeleted must be true when cleanupStatus=deleted.');
    if (cleanupStatus === 'deleted' && livekitProof.cleanupAttempted !== true) failures.push('StreamYard/LiveKit: livekitProviderApi.cleanupAttempted must be true when cleanupStatus=deleted.');
  }
  const d1Proof = evidence.d1ProductionPersistence || {};
  if (d1Proof.writeReadbackVerified !== true) failures.push('StreamYard/LiveKit: d1ProductionPersistence.writeReadbackVerified must be true.');
  if (d1Proof.noDemoFallback !== true) failures.push('StreamYard/LiveKit: d1ProductionPersistence.noDemoFallback must be true.');
  const roleProof = evidence.roleBoundaryProof || {};
  if (roleProof.privateProviderControlsDeniedToPublic !== true) failures.push('StreamYard/LiveKit: roleBoundaryProof.privateProviderControlsDeniedToPublic must be true.');
  if (roleProof.eventScopedAccessVerified !== true) failures.push('StreamYard/LiveKit: roleBoundaryProof.eventScopedAccessVerified must be true.');
  for (const laneName of ['cloudflareStreamFallback', 'dailyFallback', 'zoomEscalation', 'googleMeetFallback', 'resendEmail']) {
    const lane = evidence[laneName];
    if (lane && lane.configured === true && lane.proofPassed !== true) failures.push(`StreamYard/LiveKit: ${laneName}.proofPassed must be true when configured.`);
  }
  const streamyardProviderApi = evidence.streamyardProviderApi || {};
  if (streamyardProviderApi.automaticApiProofAvailable === true) failures.push('StreamYard/LiveKit: streamyardProviderApi.automaticApiProofAvailable must remain false unless enterprise API automation has been implemented and validated.');
  const streamyardCompatible = evidence.streamyardCompatibleRtmpPath || {};
  if (streamyardCompatible.proofPassed !== true) failures.push('StreamYard/LiveKit: streamyardCompatibleRtmpPath.proofPassed must be true.');
  if (streamyardCompatible.cleanupStatus !== 'deleted') failures.push('StreamYard/LiveKit: streamyardCompatibleRtmpPath.cleanupStatus must be deleted.');
  const cloudflareProof = evidence.cloudflareStreamFallback || {};
  if (cloudflareProof.configured === true) {
    if (cloudflareProof.proofPassed !== true) failures.push('StreamYard/LiveKit: cloudflareStreamFallback.proofPassed must be true when configured.');
    if (cloudflareProof.ingestCredentialIssued !== true) failures.push('StreamYard/LiveKit: cloudflareStreamFallback.ingestCredentialIssued must be true.');
    if (cloudflareProof.mediaConnectionObserved !== true) failures.push('StreamYard/LiveKit: cloudflareStreamFallback.mediaConnectionObserved must be true when Cloudflare Stream fallback is configured.');
    if (cloudflareProof.cleanupStatus !== 'deleted') failures.push('StreamYard/LiveKit: cloudflareStreamFallback.cleanupStatus must be deleted.');
  }

  const dailyProof = evidence.dailyFallback || {};
  if (dailyProof.configured === true) {
    if (dailyProof.cleanupStatus !== 'deleted') failures.push('StreamYard/LiveKit: dailyFallback.cleanupStatus must be deleted when Daily fallback is configured and tested.');
    if (dailyProof.tokenIssued !== true) failures.push('StreamYard/LiveKit: dailyFallback.tokenIssued must be true when Daily fallback is configured.');
  }
  const zoomProof = evidence.zoomEscalation || {};
  if (zoomProof.configured === true && zoomProof.cleanupStatus !== 'not_required_stateless_signature') failures.push('StreamYard/LiveKit: zoomEscalation.cleanupStatus must be not_required_stateless_signature because Zoom SDK signature proof creates no provider resource.');
  const googleProof = evidence.googleMeetFallback || {};
  if (googleProof.configured === true) {
    if (googleProof.manualOnly !== true) failures.push('StreamYard/LiveKit: googleMeetFallback.manualOnly must be true.');
    if (googleProof.cleanupStatus !== 'not_required_manual_static_link') failures.push('StreamYard/LiveKit: googleMeetFallback.cleanupStatus must be not_required_manual_static_link when configured.');
  }
  const livekitOnlyProof = evidence.livekitOnlyMode || {};
  if (livekitOnlyProof.proofPassed !== true) failures.push('StreamYard/LiveKit: livekitOnlyMode.proofPassed must be true.');
  if (livekitOnlyProof.cleanupStatus !== 'deleted') failures.push('StreamYard/LiveKit: livekitOnlyMode.cleanupStatus must be deleted.');
  const attendeeProof = evidence.attendeeLiveConsumption || {};
  for (const [key, expected] of Object.entries({
    proofPassed: true,
    attendeeStageRendered: true,
    controlledRtmpMediaObserved: true,
    attendeeLiveTokenIssuedWhenPermitted: true,
    attendeeAccessRevoked: true,
    revokedAttendeeDeniedLiveToken: true,
    attendeeAccessRePermitted: true,
    rePermittedAttendeeLiveTokenRecovered: true,
    backendLogsVisibleToAuthorizedRoles: true,
    attendeeSecretsExposed: false,
    evidenceGeneratedByThisRun: true,
  })) {
    if (attendeeProof[key] !== expected) failures.push(`StreamYard/LiveKit: attendeeLiveConsumption.${key} must be ${expected}.`);
  }
  return { ...evidence, evidencePath: path.relative(root, absolute) };
}

function run(command, name, env = {}) {
  const logFile = path.join(reportsDir, `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.log`);
  const proc = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=3072' }
  });
  const output = [`$ ${command}`, proc.stdout || '', proc.stderr || ''].join('\n');
  const sanitizedOutput = sanitizeOutput(output);
  fs.writeFileSync(logFile, sanitizedOutput);
  return {
    name,
    command,
    status: proc.status === 0 ? 'PASS' : proc.status === 2 ? 'BLOCKED' : 'FAIL',
    exitCode: proc.status,
    logFile: path.relative(root, logFile),
    excerpt: logExcerpt(sanitizedOutput),
  };
}

const failures = [];
const warnings = [];
const lanes = [];
const deployedBaseUrl = baseUrl();

if (process.env.TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF !== '1') failures.push('Tier 4 requires TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1.');
if (!isNonLocalUrl(deployedBaseUrl)) failures.push('Tier 4 requires explicit non-local deployed URL via POSTDEPLOY_BASE_URL, SMOKE_BASE_URL, PLAYWRIGHT_BASE_URL, or NEXT_PUBLIC_APP_URL.');

requireAll(['STREAMYARD_REAL_PROVIDER_SMOKE', 'STREAMYARD_OPERATOR_CONFIRMED_BROADCAST'], failures, 'StreamYard/LiveKit');
if (process.env.STREAMYARD_REAL_PROVIDER_SMOKE && process.env.STREAMYARD_REAL_PROVIDER_SMOKE !== '1') failures.push('StreamYard/LiveKit: STREAMYARD_REAL_PROVIDER_SMOKE must be 1.');
if (process.env.STREAMYARD_OPERATOR_CONFIRMED_BROADCAST && process.env.STREAMYARD_OPERATOR_CONFIRMED_BROADCAST !== '1') failures.push('StreamYard/LiveKit: STREAMYARD_OPERATOR_CONFIRMED_BROADCAST must be 1.');
requireAll(['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_WEBHOOK_SECRET'], failures, 'LiveKit');

const evidence = inspectEvidence(process.env.TIER4_STREAMYARD_LIVE_EVIDENCE_PATH, failures);

requireAll(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'], failures, 'D1 production persistence');

const cloudflareStreamEnabled = optionalLaneEnabled(['CLOUDFLARE_STREAM_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_STREAM_FALLBACK_ENABLED']);
if (cloudflareStreamEnabled) {
  if (!process.env.CLOUDFLARE_STREAM_ACCOUNT_ID && !process.env.CLOUDFLARE_ACCOUNT_ID) failures.push('Cloudflare Stream fallback: missing CLOUDFLARE_STREAM_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID.');
  if (!process.env.CLOUDFLARE_STREAM_API_TOKEN && !process.env.CLOUDFLARE_API_TOKEN) failures.push('Cloudflare Stream fallback: missing CLOUDFLARE_STREAM_API_TOKEN or CLOUDFLARE_API_TOKEN.');
  if (process.env.TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER !== '1') failures.push('Cloudflare Stream fallback: TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER must be 1 for full Tier 4 proof.');
} else warnings.push('Cloudflare Stream fallback Tier 4 lane not configured; must be configured before COMPLETE because it is the fallback between StreamYard/LiveKit and Daily.');

const dailyEnabled = optionalLaneEnabled(['DAILY_API_KEY', 'DAILY_DOMAIN', 'DAILY_API_BASE_URL', 'DAILY_FALLBACK_ENABLED']);
if (dailyEnabled) requireAll(['DAILY_API_KEY', 'DAILY_DOMAIN'], failures, 'Daily fallback');
else warnings.push('Daily fallback Tier 4 lane not configured; must be explicitly accepted as not applicable before COMPLETE if Daily is a production provider.');

const zoomEnabled = optionalLaneEnabled(['ZOOM_MEETING_SDK_KEY', 'ZOOM_MEETING_SDK_SECRET']);
if (zoomEnabled) requireAll(['ZOOM_MEETING_SDK_KEY', 'ZOOM_MEETING_SDK_SECRET'], failures, 'Zoom fallback');
else warnings.push('Zoom Tier 4 lane not configured; must be explicitly accepted as not applicable before COMPLETE if Zoom is a production fallback.');

const googleMeetEnabled = optionalLaneEnabled(['GOOGLE_MEET_MANAGED_FALLBACK_URL', 'GOOGLE_MEET_EMERGENCY_URL']);
if (!googleMeetEnabled && !process.env.TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON) warnings.push('Google Meet fallback Tier 4 lane not configured; provide GOOGLE_MEET_MANAGED_FALLBACK_URL/GOOGLE_MEET_EMERGENCY_URL or TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON.');

const resendEnabled = optionalLaneEnabled(['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO', 'TIER4_EMAIL_TEST_TO']);
if (resendEnabled) requireAll(['RESEND_API_KEY', 'EMAIL_FROM', 'TIER4_EMAIL_TEST_TO'], failures, 'Resend transactional email');
else warnings.push('Resend Tier 4 lane not configured; must be explicitly accepted as not applicable before COMPLETE if transactional email is production-critical.');

const envKeys = [
  'POSTDEPLOY_BASE_URL', 'SMOKE_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'NEXT_PUBLIC_APP_URL',
  'TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF', 'STREAMYARD_REAL_PROVIDER_SMOKE', 'STREAMYARD_OPERATOR_CONFIRMED_BROADCAST',
  'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_WEBHOOK_SECRET', 'LIVEKIT_INGRESS_RTMP_BASE_URL',
  'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_STREAM_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_STREAM_FALLBACK_ENABLED', 'TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER',
  'DAILY_API_KEY', 'DAILY_DOMAIN', 'DAILY_API_BASE_URL', 'DAILY_FALLBACK_ENABLED',
  'ZOOM_MEETING_SDK_KEY', 'ZOOM_MEETING_SDK_SECRET',
  'GOOGLE_MEET_MANAGED_FALLBACK_URL', 'GOOGLE_MEET_EMERGENCY_URL', 'TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON',
  'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO', 'TIER4_EMAIL_TEST_TO'
];

if (!failures.length) {
  const tier4EventId = evidence?.eventId || process.env.TIER4_EVENT_ID || process.env.STREAMYARD_E2E_EVENT_ID || '';
  const tier4StageId = evidence?.stageId || process.env.TIER4_STAGE_ID || process.env.STREAMYARD_E2E_STAGE_ID || 'main-stage';
  const sharedTier4Env = {
    POSTDEPLOY_BASE_URL: deployedBaseUrl,
    SMOKE_BASE_URL: deployedBaseUrl,
    PLAYWRIGHT_BASE_URL: deployedBaseUrl,
    TIER4_EVENT_ID: tier4EventId,
    TIER4_STAGE_ID: tier4StageId,
    STREAMYARD_E2E_EVENT_ID: tier4EventId,
    STREAMYARD_E2E_STAGE_ID: tier4StageId,
    TIER4_STREAMYARD_LIVE_EVIDENCE_PATH: process.env.TIER4_STREAMYARD_LIVE_EVIDENCE_PATH || '',
    TIER4_HEADED: process.env.TIER4_HEADED || '',
    PLAYWRIGHT_HEADLESS: process.env.TIER4_HEADED === '1' ? '0' : process.env.PLAYWRIGHT_HEADLESS || '',
  };
  lanes.push(run('npm run postdeploy:full', 'tier4-prereq-postdeploy-full', sharedTier4Env));
  lanes.push(run('npm run tier4:real-provider-journey-probe', 'tier4-real-provider-journey-probe', { ...sharedTier4Env, TIER4_CONTINUE_AFTER_FAILURE: process.env.TIER4_CONTINUE_AFTER_FAILURE || '1', TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER: process.env.TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER || '' }));
  const controlledCoverage = controlledEvidenceCoversStreamYard(evidence);
  const requireLegacyStreamYardE2E = process.env.TIER4_REQUIRE_LEGACY_STREAMYARD_E2E === '1';
  if (controlledCoverage && !requireLegacyStreamYardE2E) {
    appendSyntheticLane('tier4-streamyard-livekit-smoke', 'Covered by controlled RTMP broadcast, same-room LiveKit provider proof, attendee consumption gauntlet, and redacted evidence JSON. Set TIER4_REQUIRE_LEGACY_STREAMYARD_E2E=1 to force the legacy StreamYard Playwright smoke.', evidence.evidencePath);
    appendSyntheticLane('tier4-real-streamyard-livekit-e2e', 'Covered by controlled RTMP broadcast, same-room LiveKit provider proof, attendee consumption gauntlet, and redacted evidence JSON. Set TIER4_REQUIRE_LEGACY_STREAMYARD_E2E=1 to force the legacy StreamYard media E2E.', evidence.evidencePath);
  } else {
    lanes.push(run('npm run smoke:streamyard-livekit:real', 'tier4-streamyard-livekit-smoke', sharedTier4Env));
    lanes.push(run('npm run test:e2e:tier4-real-streamyard-livekit', 'tier4-real-streamyard-livekit-e2e', sharedTier4Env));
  }
  lanes.push(run('npm run test:e2e:tier4-real-provider-journeys', 'tier4-real-provider-journeys-e2e', sharedTier4Env));
  for (const lane of lanes) {
    if (lane.status !== 'PASS') failures.push(`${lane.name}: ${lane.status} exit=${lane.exitCode}; see ${lane.logFile}`);
  }
} else {
  lanes.push({ name: 'tier4-prereq-postdeploy-full', status: 'BLOCKED', reason: 'Prerequisites failed before command execution.' });
  lanes.push({ name: 'tier4-real-provider-journey-probe', status: 'BLOCKED', reason: 'Prerequisites failed before command execution.' });
  lanes.push({ name: 'tier4-streamyard-livekit-smoke', status: 'BLOCKED', reason: 'Prerequisites failed before command execution.' });
  lanes.push({ name: 'tier4-real-streamyard-livekit-e2e', status: 'BLOCKED', reason: 'Prerequisites failed before command execution.' });
  lanes.push({ name: 'tier4-real-provider-journeys-e2e', status: 'BLOCKED', reason: 'Prerequisites failed before command execution.' });
}

const failureDetails = collectFailureDetails(lanes);
const proofSummary = buildProofSummary(evidence, lanes);

const report = {
  repo: 'agency-event-os',
  generatedAt: new Date().toISOString(),
  tier: 4,
  deployedBaseUrl,
  result: failures.length ? 'BLOCKED_OR_FAIL' : 'PASS',
  statusLabel: failures.length ? 'BLOCKED — TIER 4 LIVE PROVIDER EVIDENCE REQUIRED' : 'TIER 4 PASSED — REAL LIVE PROVIDER OPERATIONAL PROOF',
  envStatus: envKeys.map(envStatus),
  evidence,
  lanes,
  warnings,
  failures,
  proofSummary,
  failureDetails
};

fs.writeFileSync(path.join(reportsDir, 'tier4-provider-proof-report.json'), JSON.stringify(report, null, 2) + '\n');
const md = [];
md.push('# Tier 4 Provider Proof Report');
md.push('');
md.push(`Repo: ${report.repo}`);
md.push(`Generated: ${report.generatedAt}`);
md.push(`Base URL: ${report.deployedBaseUrl || 'MISSING'}`);
md.push(`Result: ${report.statusLabel}`);
md.push('');
md.push('## Lanes');
for (const lane of lanes) md.push(`- ${lane.name}: ${lane.status}${lane.logFile ? ` (${lane.logFile})` : ''}${lane.reason ? ` — ${lane.reason}` : ''}`);
md.push('');
md.push('## Evidence');
md.push(evidence ? `- StreamYard/LiveKit evidence: ${evidence.evidencePath}` : '- StreamYard/LiveKit evidence: MISSING/INVALID');
md.push('');
md.push('## Proof Summary');
md.push(`- Deployed runtime verified: ${proofSummary.deployedRuntime.verified}`);
md.push(`- StreamYard-compatible RTMP into LiveKit: ${proofSummary.streamyardLiveKitPrimary.proofPassed}`);
md.push(`- LiveKit ingress created/observed: ${proofSummary.streamyardLiveKitPrimary.livekitIngressCreatedOrObserved}`);
md.push(`- Same-room LiveKit media observed: ${proofSummary.streamyardLiveKitPrimary.sameRoomObserved}`);
md.push(`- Cloudflare Stream fallback proof: ${proofSummary.cloudflareStreamFallback.proofPassed}`);
md.push(`- Daily fallback proof: ${proofSummary.dailyFallback.proofPassed}`);
md.push(`- Zoom authorized fallback proof: ${proofSummary.zoomFallback.proofPassed}`);
md.push(`- Attendee can join when permitted: ${proofSummary.attendeeLiveControls.attendeeCanJoinWhenPermitted}`);
md.push(`- Attendee revoked: ${proofSummary.attendeeLiveControls.attendeeRevoked}`);
md.push(`- Revoked attendee denied live token: ${proofSummary.attendeeLiveControls.revokedAttendeeDeniedLiveToken}`);
md.push(`- Attendee re-permitted/recovered: ${proofSummary.attendeeLiveControls.rePermittedAttendeeRecoveredLiveToken}`);
md.push(`- Backend live-control logs visible to authorized roles: ${proofSummary.attendeeLiveControls.backendLogsVisibleToAuthorizedRoles}`);
if (proofSummary.attendeeLiveControls.screenshot) md.push(`- Headed/browser artifact screenshot: ${proofSummary.attendeeLiveControls.screenshot}`);
md.push(`- Headed Tier 4 mode: ${proofSummary.e2eHarness.command}`);
md.push('');
md.push('## Warnings');
md.push(warnings.length ? warnings.map((warning) => `- ${warning}`).join('\n') : 'None.');
md.push('');
md.push('## Failures');
md.push(failures.length ? failures.map((failure) => `- ${failure}`).join('\n') : 'None.');
md.push('');
md.push('## Failure Details');
if (failureDetails.length) {
  for (const detail of failureDetails) {
    md.push(`### ${detail.lane}`);
    md.push(`- Status: ${detail.status}`);
    if (detail.exitCode !== undefined && detail.exitCode !== null) md.push(`- Exit: ${detail.exitCode}`);
    if (detail.logFile) md.push(`- Log: ${detail.logFile}`);
    if (detail.reason) md.push(`- Reason: ${detail.reason}`);
    if (detail.nestedFailures?.length) {
      md.push('- Nested failures:');
      for (const nestedFailure of detail.nestedFailures) md.push(`  - ${nestedFailure}`);
    }
    if (detail.nestedLanes?.length) {
      md.push('- Nested lanes:');
      for (const nested of detail.nestedLanes) md.push(`  - ${nested.name}: ${nested.status}${nested.error ? ` — ${nested.error}` : ''}${nested.reason ? ` — ${nested.reason}` : ''}${nested.cleanupStatus ? ` (cleanup: ${nested.cleanupStatus})` : ''}`);
    }
    if (detail.excerpt) {
      md.push('- Log excerpt:');
      md.push('```');
      md.push(detail.excerpt);
      md.push('```');
    }
    md.push('');
  }
} else {
  md.push('None.');
}
fs.writeFileSync(path.join(reportsDir, 'tier4-provider-proof-report.md'), md.join('\n') + '\n');

console.log(md.join('\n'));
process.exit(failures.length ? 2 : 0);
