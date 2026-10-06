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
function requireIncludes(file, terms) {
  const body = read(file);
  for (const term of terms) {
    const re = term instanceof RegExp ? term : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (!re.test(body)) failures.push(`${file} missing required Tier 4 hostile coverage marker: ${term}`);
  }
}

requireIncludes('scripts/tier4_live_provider_operational_proof.mjs', [
  'tier4:real-provider-journey-probe',
  'deploymentIdentity',
  'livekitProviderApi',
  'cloudflareStreamFallback',
  'd1ProductionPersistence',
  'roleBoundaryProof',
  'cloudflareStreamFallback',
  'cloudflareStreamFallback',
  'dailyFallback',
  'zoomEscalation',
  'resendEmail'
]);
requireIncludes('scripts/tier4_real_provider_journey_probe.mjs', [
  'LiveKit real ingress via deployed app',
  'D1 production persistence readback',
  'Cloudflare Stream Live fallback provider',
  'Daily real fallback provider',
  'Zoom authorized manual escalation',
  'Resend transactional email',
  'role boundary private provider APIs',
  'V5_ACCESS_COOKIE_SECRET',
  'TIER4_RESEND_SEND_APPROVED'
]);
requireIncludes('app/api/video/zoom-signature/route.ts', [
  'authorizeVideoTokenRequest',
  'eventId is required for Zoom fallback authorization',
  'videoRole',
  '403'
]);
requireIncludes('TIER4_PROVIDER_EVIDENCE_TEMPLATE.json', [
  'deploymentIdentity',
  'livekitProviderApi',
  'cloudflareStreamFallback',
  'd1ProductionPersistence',
  'roleBoundaryProof',
  'cloudflareStreamFallback',
  'cloudflareStreamFallback',
  'dailyFallback',
  'zoomEscalation',
  'resendEmail'
]);
requireIncludes('REAL_PROVIDER_LANE_MATRIX.md', [
  'deployed app route',
  'write/readback',
  'unauthenticated denial',
  'provider message id',
  'no demo fallback'
]);
requireIncludes('TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF.md', [
  'Tier 4 real provider journey probe',
  'Cloudflare Stream Live fallback',
  'Zoom signature route is server-side authorization gated',
  'D1 production write/readback',
  'Resend sends exactly one approved test email'
]);

const pkg = JSON.parse(read('package.json'));
for (const script of ['tier4:real-provider-journey-probe', 'validate:tier4-hostile-coverage']) {
  if (!pkg.scripts?.[script]) failures.push(`package.json missing ${script}`);
}
if (!String(pkg.scripts?.['validate:tier4-contract'] || '').includes('validate:tier4-hostile-coverage')) failures.push('validate:tier4-contract must run validate:tier4-hostile-coverage.');

if (failures.length) {
  console.error('TIER 4 HOSTILE COVERAGE VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('TIER 4 HOSTILE COVERAGE VALIDATION OK — Tier 4 blocks on real provider, persistence, role, fallback, email, and evidence proof.');
