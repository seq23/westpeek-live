#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const requiredDocs = [
  'TIER_VALIDATION_MODEL.md',
  'REAL_PROVIDER_LANE_MATRIX.md',
  'TESTING_SEQUENCE.md',
  'TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF.md',
  'TIER4_PROVIDER_EVIDENCE_TEMPLATE.json'
];

function read(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    failures.push(`Missing required Tier 4 doc: ${file}`);
    return '';
  }
  return fs.readFileSync(p, 'utf8');
}

for (const doc of requiredDocs) read(doc);
const tierDoc = read('TIER_VALIDATION_MODEL.md');
if (!/Tier 3[\s\S]{0,900}safe provider boundary/i.test(tierDoc)) failures.push('TIER_VALIDATION_MODEL.md must define Tier 3 as deployed-safe provider boundary.');
if (!/Tier 4[\s\S]{0,1200}real StreamYard[\s\S]{0,1200}LiveKit/i.test(tierDoc)) failures.push('TIER_VALIDATION_MODEL.md must define Tier 4 as real StreamYard/LiveKit operational proof.');
if (!/COMPLETE from Tier 3 when real provider proof is required/i.test(tierDoc)) failures.push('TIER_VALIDATION_MODEL.md must forbid COMPLETE from Tier 3 when Tier 4 is required.');

const providerDoc = read('REAL_PROVIDER_LANE_MATRIX.md');
for (const term of ['LiveKit media lifecycle', 'StreamYard live broadcast', 'Daily fallback', 'Zoom manual escalation', 'D1 persistence', 'Email / Resend', 'Cloudflare/OpenNext Worker']) {
  if (!providerDoc.includes(term)) failures.push(`REAL_PROVIDER_LANE_MATRIX.md missing provider lane: ${term}`);
}
if (!/Only Tier 4 may satisfy real live provider operational proof/i.test(providerDoc)) failures.push('REAL_PROVIDER_LANE_MATRIX.md must state only Tier 4 satisfies real live provider proof.');

const testingDoc = read('TESTING_SEQUENCE.md');
if (!/--tier=4/i.test(testingDoc)) failures.push('TESTING_SEQUENCE.md must include a Tier 4 command.');
if (!/TIER4_STREAMYARD_LIVE_EVIDENCE_PATH/i.test(testingDoc)) failures.push('TESTING_SEQUENCE.md must require Tier 4 StreamYard evidence path.');

try {
  const evidence = JSON.parse(read('TIER4_PROVIDER_EVIDENCE_TEMPLATE.json'));
  for (const key of ['providerLane', 'deployedBaseUrl', 'eventId', 'operatorConfirmedBroadcast', 'appReportedStates', 'secretsExposed', 'cleanupStatus']) {
    if (!(key in evidence)) failures.push(`TIER4_PROVIDER_EVIDENCE_TEMPLATE.json missing ${key}`);
  }
} catch (error) {
  failures.push(`TIER4_PROVIDER_EVIDENCE_TEMPLATE.json invalid JSON: ${error.message}`);
}

const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts || {};
for (const script of ['tier4:live-provider-operational-proof', 'validate:tier4-contract', 'test:everything:tier4', 'test:everything:tier4:with-env']) {
  if (!scripts[script]) failures.push(`package.json missing script ${script}`);
}

const matrix = JSON.parse(read('_repo_validation_matrix.json'));
const rows = matrix.validation || matrix.entries || [];
if (!matrix.tierPolicy || !/provider|live|credential|operational/i.test(String(matrix.tierPolicy.tier4 || ''))) failures.push('_repo_validation_matrix.json must include tierPolicy.tier4 with live-provider proof.');
if (!rows.some((row) => String(row.tier).toLowerCase().includes('4') && /live-provider/i.test(`${row.name} ${row.command} ${row.category}`))) failures.push('_repo_validation_matrix.json must include Tier 4 live-provider row.');

if (failures.length) {
  console.error('TIER 4 CONTRACT VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('TIER 4 CONTRACT VALIDATION OK — Tier 3 is deployed-safe; Tier 4 is final real live-provider operational proof.');
