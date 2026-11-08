#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
function read(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { failures.push(`Missing ${file}`); return ''; }
  return fs.readFileSync(p, 'utf8');
}
function requireText(file, terms) {
  const body = read(file);
  for (const term of terms) {
    const text = typeof term === 'string' ? term : term.source;
    const ok = typeof term === 'string' ? body.includes(term) : term.test(body);
    if (!ok) failures.push(`${file} missing runtime fallback marker: ${text}`);
  }
}
function forbidText(file, terms) {
  const body = read(file);
  for (const term of terms) {
    const text = typeof term === 'string' ? term : term.source;
    const bad = typeof term === 'string' ? body.includes(term) : term.test(body);
    if (bad) failures.push(`${file} contains forbidden attendee-visible provider marker: ${text}`);
  }
}

requireText('types/stageStream.ts', [
  '"LIVEKIT_INGRESS" | "CLOUDFLARE_STREAM" | "DAILY" | "ZOOM" | "GOOGLE_MEET"',
  'cloudflareStreamPlaybackUrl',
  'googleMeetFallbackUrl',
  'operator_rollback_to_livekit',
  'operator_rollback_to_cloudflare_stream',
  'daily_failed',
  'zoom_failed',
]);
requireText('services/video/stageStreamStateService.ts', [
  'activateCloudflareFallback',
  'activateDailyFallback',
  'activateZoomFallback',
  'activateGoogleMeetFallback',
  'ingress_ended',
  'cloudflare_stream_failed',
  'daily_failed',
  'zoom_failed',
  'operator_rollback_to_livekit',
  'first rung where attendees may need explicit external-room instructions',
  'do not expose provider detail to attendees',
]);
requireText('services/video/roomFallbackService.ts', [
  '["livekit", "cloudflare_stream", "daily", "zoom", "google_meet"]',
  'provider === "cloudflare_stream" || provider === "daily"',
  'Zoom and Google Meet fallback require explicit crew confirmation',
]);
requireText('services/video/videoFallbackPolicy.ts', [
  '["livekit", "cloudflare_stream", "daily", "zoom_sdk", "google_meet"]',
  '["livekit", "cloudflare_stream", "zoom_sdk", "google_meet"]',
]);
requireText('components/video/StagePlayer.tsx', [
  'CloudflareStreamFallbackStagePlayer',
  'ZoomEmbeddedRoom',
  'GoogleMeetFallbackStagePlayer',
  'attendeeOverlayMessage',
  'state.activeStreamSource === "GOOGLE_MEET" ? "Final backup room active" : "Live stage connected"',
]);
requireText('components/testing/StreamYardIngressPanel.tsx', [
  'Backend showrunner fallback console',
  'Show-day ladder',
  'Move down: Cloudflare Stream',
  'Move down: Daily',
  'Move down: Zoom',
  'Move down: Google Meet',
  'Move back up: LiveKit/StreamYard',
  'Move back up: Cloudflare',
  'Fallback event log',
  'owner showrunner crew logs',
]);
forbidText('components/venue/MainStageExperience.tsx', ['Active provider: {fallbackState.activeProvider}']);
forbidText('components/venue/FallbackActiveBanner.tsx', ['{state.activeProvider}']);
requireText('tests/unit/stageStreamState.test.ts', [
  'LiveKit plus Cloudflare Stream before Daily',
  'daily_failed',
  'zoom_failed',
  'operator_rollback_to_cloudflare_stream',
]);
requireText('tests/unit/videoFallbackPolicy.test.ts', ['cloudflare_stream', 'places Cloudflare Stream between LiveKit/StreamYard and Daily']);
requireText('HOSTILE_CODE_REVIEW_TIER4_LIVE_EVENT_FALLBACK_2026-06-12.md', [
  'Verdict',
  'Attendee-visible provider leakage',
  'Show-day ladder order',
  'Move back up the ladder',
  'Remaining proof limit',
]);

const pkg = JSON.parse(read('package.json') || '{}');
if (!pkg.scripts?.['validate:tier4-live-event-fallback-runtime']) failures.push('package.json missing validate:tier4-live-event-fallback-runtime');
if (!String(pkg.scripts?.['validate:deploy-parity'] || '').includes('validate:tier4-live-event-fallback-runtime')) failures.push('validate:deploy-parity must include validate:tier4-live-event-fallback-runtime');
if (!String(pkg.scripts?.['validate:tier4-contract'] || '').includes('validate:tier4-live-event-fallback-runtime')) failures.push('validate:tier4-contract must include validate:tier4-live-event-fallback-runtime');

if (failures.length) {
  console.error('TIER 4 LIVE EVENT FALLBACK RUNTIME CONTRACT VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('TIER 4 LIVE EVENT FALLBACK RUNTIME CONTRACT VALIDATION OK — app ladder, backend controls, attendee masking, logs, and rollback controls are explicit.');
