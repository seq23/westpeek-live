#!/usr/bin/env node
// No NEXT_PUBLIC_* secret, token or key: a NEXT_PUBLIC_ value is compiled into
// the browser bundle. Trimmed 10 Nov 2026 to this rule (hostile review of the
// validator cut). Reads every env name the contract and the example files declare.
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const contractPath = path.join(root, '_env_contract.json');
if (!fs.existsSync(contractPath)) throw new Error('_env_contract.json is required.');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const names = new Set([...(contract.requiredRuntimeEnv || []), ...(contract.optionalRuntimeEnv || []), ...(contract.localOnlyEnv || [])]);
for (const name of ['.env.example', '.env.local.example', '.env.preview.example', '.env.production.example']) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) continue;
  for (const m of fs.readFileSync(p, 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)) names.add(m[1]);
}
if (!names.size) { console.error('validate-env: examined zero env names'); process.exit(1); }
const leaks = [...names].filter((key) => /^NEXT_PUBLIC_/i.test(key) && /SECRET|TOKEN|PRIVATE|SERVICE_ROLE|API_KEY|PASSWORD/i.test(key));
if (leaks.length) { console.error(`validate-env: FAIL — browser-exposed secret name(s): ${leaks.join(', ')}`); process.exit(1); }
console.log(`validate-env: PASS — ${names.size} env names, none a NEXT_PUBLIC_ secret.`);
