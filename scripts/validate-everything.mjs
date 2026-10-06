#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const repo = packageJson.name || path.basename(root);
const tierArg = [...args].find((arg) => arg.startsWith('--tier='));
const tier = tierArg ? tierArg.split('=')[1] : 'all';
const tier3Deployed = tier === '3' || tier === 'tier3' || tier === '4' || tier === 'tier4' || tier === 'all';
const tier4Ultimate = tier === '4' || tier === 'tier4' || tier === 'all';
const includePostdeploy = tier3Deployed || args.has('--postdeploy') || Boolean(process.env.POSTDEPLOY_BASE_URL || process.env.SMOKE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL);
const includeRealProvider = tier4Ultimate || args.has('--real-provider') || process.env.TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF === '1' || process.env.STREAMYARD_REAL_PROVIDER_SMOKE === '1' || process.env.WEST_PEEK_LIVE_PROVIDER_PROOF === '1';
const reportsDir = path.join(root, 'reports');
const logsDir = path.join(root, 'logs');
fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

function hasScript(name) {
  return Boolean(packageJson.scripts && packageJson.scripts[name]);
}

function commandForScript(name) {
  return ['npm', ['run', name]];
}

const matrixPath = path.join(root, '_repo_validation_matrix.json');
const matrix = fs.existsSync(matrixPath) ? JSON.parse(fs.readFileSync(matrixPath, 'utf8')) : { validation: [] };
const rows = Array.isArray(matrix.validation) ? matrix.validation : [];
const commands = [];
const seen = new Set();

for (const row of rows) {
  if (!row.command || row.command === 'manual' || row.command === 'manual_provider_proof') continue;
  const rowTier = String(row.tier || 'tier1');
  const proof = String(row.proofLayer || row.category || '');
  if (tier === '1' && rowTier !== 'tier1') continue;
  if (tier === '2' && !['tier1', 'tier2'].includes(rowTier)) continue;
  if (tier === '3' && !['tier1', 'tier2', 'tier3'].includes(rowTier)) continue;
  if (tier === '4' && !['tier1', 'tier2', 'tier3', 'tier4'].includes(rowTier)) continue;
  if (/postdeploy|deployed/i.test(proof) && !includePostdeploy) continue;
  if (/real provider|live provider|manual provider|StreamYard|LiveKit|Tier 4/i.test(proof) && !includeRealProvider) continue;
  if (seen.has(row.command)) continue;
  seen.add(row.command);
  commands.push(row);
}

function missingTier3Inputs(row) {
  const command = String(row.command || '');
  const text = `${row.name || ''} ${row.proofLayer || ''} ${row.category || ''} ${command}`;
  const missing = [];
  if (/postdeploy|deployed/i.test(text) && !(process.env.POSTDEPLOY_BASE_URL || process.env.SMOKE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL)) missing.push('POSTDEPLOY_BASE_URL or SMOKE_BASE_URL or PLAYWRIGHT_BASE_URL or NEXT_PUBLIC_APP_URL');
  if (/Tier 4|live-provider|real provider|StreamYard|real-streamyard|streamyard/i.test(text) && process.env.TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF !== '1' && String(row.tier || '').toLowerCase().includes('4')) missing.push('TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1');
  if (/StreamYard|real-streamyard|streamyard/i.test(text) && process.env.STREAMYARD_REAL_PROVIDER_SMOKE !== '1') missing.push('STREAMYARD_REAL_PROVIDER_SMOKE=1');
  if (/StreamYard|real-streamyard|streamyard/i.test(text) && process.env.STREAMYARD_OPERATOR_CONFIRMED_BROADCAST !== '1' && String(row.tier || '').toLowerCase().includes('4')) missing.push('STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1');
  if (/StreamYard|real-streamyard|streamyard/i.test(text) && !process.env.TIER4_STREAMYARD_LIVE_EVIDENCE_PATH && String(row.tier || '').toLowerCase().includes('4')) missing.push('TIER4_STREAMYARD_LIVE_EVIDENCE_PATH');
  if (/LiveKit|real-streamyard|livekit/i.test(text)) {
    for (const key of ['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET','LIVEKIT_WEBHOOK_SECRET']) if (!process.env[key]) missing.push(key);
  }
  if (/D1|persistence|created/i.test(text)) {
    for (const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID']) if (!process.env[key]) missing.push(key);
  }
  return [...new Set(missing)];
}

function run(row) {
  const command = row.command;
  const label = row.name || command;
  const started = new Date().toISOString();
  const logFile = path.join(logsDir, `validate-everything-${label.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.log`);
  let result = { label, command, tier: row.tier || 'tier1', severity: row.severity || 'UNKNOWN', proofLayer: row.proofLayer || row.category || 'UNKNOWN', status: 'UNPROVEN', exitCode: null, started, ended: null, logFile: path.relative(root, logFile) };
  const rowTier = String(row.tier || 'tier1').toLowerCase();
  const proofText = `${row.proofLayer || ''} ${row.category || ''} ${row.name || ''} ${command}`;
  if ((tier3Deployed && rowTier.includes('3') && /postdeploy|deployed/i.test(proofText)) || (tier4Ultimate && rowTier.includes('4') && /postdeploy|deployed|real provider|live provider|StreamYard|LiveKit|Tier 4/i.test(proofText))) {
    const missing = missingTier3Inputs(row);
    if (missing.length) {
      result.status = 'UNPROVEN';
      result.ended = new Date().toISOString();
      result.reason = `Required Tier 3 deployed/provider inputs missing: ${missing.join(', ')}`;
      fs.writeFileSync(logFile, `${result.reason}\n`);
      return result;
    }
  }
  if (command.startsWith('npm run ')) {
    const scriptName = command.replace(/^npm run\s+/, '').split(/\s+/)[0];
    if (!hasScript(scriptName)) {
      result.status = 'UNPROVEN';
      result.exitCode = null;
      result.ended = new Date().toISOString();
      fs.writeFileSync(logFile, `SKIPPED — package script not present: ${scriptName}\n`);
      return result;
    }
  }
  const proc = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=3072' } });
  result.exitCode = proc.status;
  result.ended = new Date().toISOString();
  fs.writeFileSync(logFile, [`$ ${command}`, proc.stdout || '', proc.stderr || ''].join('\n'));
  result.status = proc.status === 0 ? 'PASS' : 'FAIL';
  return result;
}

const results = commands.map(run);
const hardFailures = results.filter((r) => r.status === 'FAIL' && String(r.severity).toUpperCase().includes('HARD FAIL'));
const hardUnproven = results.filter((r) => r.status === 'UNPROVEN' && String(r.severity).toUpperCase().includes('HARD FAIL'));
const unproven = results.filter((r) => r.status === 'UNPROVEN');
const jsonReport = {
  repo,
  generatedAt: new Date().toISOString(),
  mode: 'Master Addendum validate:everything',
  tier,
  includePostdeploy,
  includeRealProvider,
  result: hardFailures.length || hardUnproven.length ? 'FAIL' : (unproven.length ? 'PASS_WITH_UNPROVEN' : 'PASS'),
  counts: { total: results.length, pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length, unproven: unproven.length, hardFailures: hardFailures.length, hardUnproven: hardUnproven.length },
  results
};
fs.writeFileSync(path.join(reportsDir, 'validate-everything.json'), JSON.stringify(jsonReport, null, 2) + '\n');

const md = [];
md.push(`# Validate Everything Report — ${repo}`);
md.push('');
md.push(`Generated: ${jsonReport.generatedAt}`);
md.push(`Mode: ${jsonReport.mode}`);
md.push(`Tier: ${tier}`);
md.push(`Tier 3 deployed-safe mode: ${tier3Deployed ? 'YES' : 'NO'}`);
md.push(`Postdeploy included: ${includePostdeploy ? 'YES' : 'NO'}`);
md.push(`Real provider included: ${includeRealProvider ? 'YES' : 'NO'}`);
md.push(`Tier 4 ultimate mode: ${tier4Ultimate ? 'YES' : 'NO'}`);
md.push(`Result: ${jsonReport.result}`);
md.push('');
md.push('| Lane | Command | Severity | Proof layer | Status | Log |');
md.push('|---|---|---|---|---|---|');
for (const r of results) md.push(`| ${r.label} | \`${r.command}\` | ${r.severity} | ${r.proofLayer} | ${r.status} | ${r.logFile} |`);
md.push('');
md.push('## Completion impact');
if (hardFailures.length) md.push('- HARD FAIL lanes failed. COMPLETE is blocked.');
if (hardUnproven.length) md.push('- HARD FAIL Tier 3 lanes are UNPROVEN. COMPLETE is blocked until deployed/provider evidence is supplied.');
if (!hardFailures.length && !hardUnproven.length) md.push('- No selected HARD FAIL lane failed or remained unproven. This does not prove lanes outside the selected tier.');
if (unproven.length) md.push('- Some lanes are UNPROVEN. They must be named in delivery status.');
if (!includePostdeploy) md.push('- Postdeploy lanes were not included. Deployed runtime is NOT PROVEN.');
if (!includeRealProvider) md.push('- Real provider lanes were not included. Live provider/media behavior is NOT PROVEN. Tier 4 is required before COMPLETE when real providers are in scope.');
fs.writeFileSync(path.join(reportsDir, 'validate-everything.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
process.exit(hardFailures.length || hardUnproven.length ? 1 : 0);
