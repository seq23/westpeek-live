#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {verifyWorkerTarget} from './read-wrangler-config.mjs';
const root=process.cwd();
const file=path.join(root,'.github/workflows/deploy-cloudflare-worker.yml');
const failures=[];
if(!fs.existsSync(file)) failures.push('Missing .github/workflows/deploy-cloudflare-worker.yml');
const s=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
const required=[
  'timeout-minutes: 45',
  'concurrency:',
  'cancel-in-progress: true',
  'CLOUDFLARE_API_TOKEN:',
  'CLOUDFLARE_ACCOUNT_ID:',
  'npm ci --no-audit --no-fund',
  'npm run release:prepush:container',
  'npm run cf:build:recoverable',
  'test -f .open-next/worker.js',
  'npm run cf:deploy -- --keep-vars',
  'npm run postdeploy:smoke',
  'timeout --signal=TERM',
  'node scripts/read-wrangler-config.mjs',
  // Deploys itself on green main (6 Oct 2026: it was dispatch-only), schema first.
  'workflow_run:',
  'workflows: ["Repository validation"]',
  "github.event.workflow_run.conclusion == 'success'",
  'ref: ${{ github.event.workflow_run.head_sha || github.sha }}',
  'npx wrangler d1 migrations apply west-peek-live --remote',
  // The smoke checks the version this run deployed, not whichever one answers during rollout.
  'SMOKE_EXPECT_BUILD_ID: ${{ github.event.workflow_run.head_sha || github.sha }}',
  'DEPLOY_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}'
];
for(const token of required) if(!s.includes(token)) failures.push(`Cloudflare workflow missing: ${token}`);
if(s.indexOf('d1 migrations apply west-peek-live --remote')>s.indexOf('npm run cf:deploy -- --keep-vars')) failures.push('The D1 migrations must be applied before the Worker deploys.');
if(/npm run deploy:production:safe/.test(s)) failures.push('Workflow must not call the unbounded composite deploy:production:safe command.');
if(/\bcontinue-on-error:\s*true\b/.test(s)) failures.push('Deployment workflow may not hide failures with continue-on-error.');
let wrangler={};
try{
  const target=verifyWorkerTarget(root);
  wrangler=target.config;
  failures.push(...target.failures);
}catch(error){
  failures.push(error.message);
}
const report={schema_version:'1.0',workflow:'.github/workflows/deploy-cloudflare-worker.yml',worker:wrangler.name??null,failures,verdict:failures.length?'FAIL':'PASS'};
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports','cloudflare-workflow-contract.json'),JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Cloudflare deployment workflow contract: PASS');
