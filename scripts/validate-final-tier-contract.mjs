#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredDocs = [
  'TIER_VALIDATION_MODEL.md',
  'MASTER_ADDENDUM_COMPLIANCE_LEDGER.md',
  'RUNTIME_CONTEXT_TRACE_MATRIX.md',
  'REAL_PROVIDER_LANE_MATRIX.md',
  'USER_JOURNEY_TEST_MATRIX.md',
  'TESTING_SEQUENCE.md',
  'LIVE_PROVIDER_EVIDENCE_TEMPLATE.md',
  'TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF.md',
  'TIER4_PROVIDER_EVIDENCE_TEMPLATE.json'
];
const failures = [];
function read(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    failures.push(`Missing required final-tier doc: ${file}`);
    return '';
  }
  return fs.readFileSync(p, 'utf8');
}
for (const file of requiredDocs) read(file);
const tierDoc = read('TIER_VALIDATION_MODEL.md');
if (!/Tier 3[\s\S]{0,800}(deployed|postdeploy)[\s\S]{0,800}(safe provider boundary|fail safely|safe)/i.test(tierDoc)) failures.push('TIER_VALIDATION_MODEL.md must define Tier 3 as deployed safe postdeploy/provider-boundary proof.');
if (!/Tier 4[\s\S]{0,1000}(real StreamYard|StreamYard)[\s\S]{0,1000}(LiveKit|live-provider)/i.test(tierDoc)) failures.push('TIER_VALIDATION_MODEL.md must define Tier 4 as final real live-provider operational proof.');
if (!/COMPLETE from Tier 3 when real provider proof is required/i.test(tierDoc)) failures.push('TIER_VALIDATION_MODEL.md must forbid COMPLETE from Tier 3 when real provider proof is required.');
const providerDoc = read('REAL_PROVIDER_LANE_MATRIX.md');
if (!/\| Provider lane \| Provider \| Runtime\/surface/i.test(providerDoc)) failures.push('REAL_PROVIDER_LANE_MATRIX.md must contain the canonical provider lane table.');
if (!/Tier 4/i.test(providerDoc)) failures.push('REAL_PROVIDER_LANE_MATRIX.md must tie provider lanes to Tier 4.');
if (!/Only Tier 4 may satisfy real live provider operational proof/i.test(providerDoc)) failures.push('REAL_PROVIDER_LANE_MATRIX.md must clearly separate Tier 3 safe proof from Tier 4 live provider proof.');
const journeyDoc = read('USER_JOURNEY_TEST_MATRIX.md');
if (!/\| Persona \| Action/i.test(journeyDoc)) failures.push('USER_JOURNEY_TEST_MATRIX.md must contain the canonical user journey table.');
const testingDoc = read('TESTING_SEQUENCE.md');
if (!/--tier=3/i.test(testingDoc)) failures.push('TESTING_SEQUENCE.md must include a Tier 3 command.');
if (!/--tier=4/i.test(testingDoc)) failures.push('TESTING_SEQUENCE.md must include a Tier 4 command.');
if (!/explicit deployed/i.test(testingDoc) && !/deployed URL/i.test(testingDoc)) failures.push('TESTING_SEQUENCE.md must require explicit deployed URL/postdeploy target.');
if (!/TIER4_STREAMYARD_LIVE_EVIDENCE_PATH/i.test(testingDoc)) failures.push('TESTING_SEQUENCE.md must require Tier 4 StreamYard/LiveKit evidence path.');
const runtimeDoc = read('RUNTIME_CONTEXT_TRACE_MATRIX.md');
if (!/Playwright self-spawn/i.test(runtimeDoc) || !/Provider dashboard/i.test(runtimeDoc)) failures.push('RUNTIME_CONTEXT_TRACE_MATRIX.md must include self-spawn and provider runtime contexts.');
const matrixPath = path.join(root, '_repo_validation_matrix.json');
if (!fs.existsSync(matrixPath)) failures.push('Missing _repo_validation_matrix.json.');
else {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const rows = matrix.validation || matrix.entries || [];
  if (!matrix.tierPolicy || !String(matrix.tierPolicy.tier3 || '').match(/deployed|postdeploy/i)) failures.push('_repo_validation_matrix.json must include tierPolicy.tier3 with deployed/postdeploy proof.');
  if (!matrix.tierPolicy || !String(matrix.tierPolicy.tier4 || '').match(/provider|live|credential/i)) failures.push('_repo_validation_matrix.json must include tierPolicy.tier4 with live-provider proof.');
  const tier3Rows = rows.filter((row) => String(row.tier || '').toLowerCase().includes('3'));
  if (!tier3Rows.length) failures.push('_repo_validation_matrix.json must include Tier 3 rows.');
  const tier4Rows = rows.filter((row) => String(row.tier || '').toLowerCase().includes('4'));
  if (!tier4Rows.length) failures.push('_repo_validation_matrix.json must include Tier 4 rows.');
  const providerRows = tier4Rows.filter((row) => `${row.name || ''} ${row.command || ''} ${row.proofLayer || ''} ${row.category || ''}`.match(/provider|live|streamyard|livekit|d1|resend|daily|zoom|credential/i));
  if (!providerRows.length) failures.push('_repo_validation_matrix.json Tier 4 must include live provider proof rows.');
}
const packagePath = path.join(root, 'package.json');
if (!fs.existsSync(packagePath)) failures.push('Missing package.json.');
else {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = pkg.scripts || {};
  if (!scripts['validate:final-tier-contract']) failures.push('package.json must expose validate:final-tier-contract.');
  if (!scripts['validate:final-tier']) failures.push('package.json must expose validate:final-tier.');
  if (!scripts['tier4:live-provider-operational-proof']) failures.push('package.json must expose tier4:live-provider-operational-proof.');
  if (!scripts['test:everything:tier4']) failures.push('package.json must expose test:everything:tier4.');
}
if (failures.length) {
  console.error('FINAL TIER CONTRACT VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('FINAL TIER CONTRACT VALIDATION OK — Tier 3 is deployed-safe; Tier 4 is final real live-provider operational proof.');
