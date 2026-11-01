#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const registerPath = path.join(root, '_validator_admission_register.json');
const matrixPath = path.join(root, '_repo_validation_matrix.json');
const mdPath = path.join(root, 'VALIDATOR_ADMISSION_REGISTER.md');
const tokens = ['validate','test','smoke','audit','deploy','postdeploy','predeploy','probe','gauntlet','cf:','cloudflare'];
const failures = [];
function isValidationScript(name) { return tokens.some((token) => name.includes(token)); }
if (!fs.existsSync(registerPath)) failures.push('Missing _validator_admission_register.json');
if (!fs.existsSync(matrixPath)) failures.push('Missing _repo_validation_matrix.json');
if (!fs.existsSync(mdPath)) failures.push('Missing VALIDATOR_ADMISSION_REGISTER.md');
const register = fs.existsSync(registerPath) ? JSON.parse(fs.readFileSync(registerPath, 'utf8')) : { register: [] };
const admitted = new Map((register.register || []).map((row) => [row.script, row]));
const scoped = Object.keys(pkg.scripts || {}).filter(isValidationScript).sort();
for (const name of scoped) {
  const row = admitted.get(name);
  if (!row) { failures.push(`Package script is not admitted: ${name}`); continue; }
  for (const field of ['status','admission','category','severity','owner','productionRisk','whatItProves','whatItDoesNotProve','blockerPolicy','failureHandling','simplificationDisposition','removalConditions']) {
    if (!row[field]) failures.push(`Admission row for ${name} missing ${field}`);
  }
  if (!['HARD FAIL','STRONG WARNING','WARNING','INFO / NO VALIDATION'].includes(row.severity)) failures.push(`Admission row for ${name} has invalid severity: ${row.severity}`);
}
for (const row of register.register || []) {
  if (row.status === 'ACTIVE' && !pkg.scripts?.[row.script]) failures.push(`Admission row references missing package script: ${row.script}`);
}

const matrixRaw = fs.existsSync(matrixPath) ? JSON.parse(fs.readFileSync(matrixPath, 'utf8')) : { validation: [] };
const matrixRows = matrixRaw.validation || matrixRaw.entries || matrixRaw.validators || [];
for (const row of matrixRows) {
  const label = row.name || row.script || row.command || 'unnamed matrix row';
  for (const field of ['owner','tier','severity','proofLayer','blockerPolicy','simplificationDisposition']) {
    if (!row[field]) failures.push(`Validation matrix row ${label} missing ${field}`);
  }
  if (!['HARD FAIL','STRONG WARNING','WARNING','INFO / NO VALIDATION'].includes(row.severity)) failures.push(`Validation matrix row ${label} has invalid severity: ${row.severity}`);
}

if (!pkg.scripts?.['validate:validator-admission']) failures.push('Missing package script validate:validator-admission');
if (!pkg.scripts?.['validate:everything']?.includes('validate-everything.mjs')) failures.push('validate:everything must route through scripts/validate-everything.mjs');
fs.mkdirSync(path.join(root,'reports'), { recursive: true });
const report = { repo: pkg.name, generatedAt: new Date().toISOString(), scopedScripts: scoped.length, admittedScripts: admitted.size, failures };
fs.writeFileSync(path.join(root,'reports','validator-admission.json'), JSON.stringify(report,null,2)+'\n');
const md = [`# Validator Admission Report — ${pkg.name}`,'',`Generated: ${report.generatedAt}`,`Scoped scripts: ${scoped.length}`,`Admitted scripts: ${admitted.size}`,`Result: ${failures.length ? 'FAIL' : 'PASS'}`,''];
if (failures.length) { md.push('## Failures'); for (const f of failures) md.push(`- ${f}`); }
else md.push('All validation/test/smoke/audit/deploy scripts are admitted into the validator register.');
fs.writeFileSync(path.join(root,'reports','validator-admission.md'), md.join('\n')+'\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Validator admission PASS — ${scoped.length} scripts admitted.`);
