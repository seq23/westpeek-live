#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const max=Number(process.env.SELF_HEAL_MAX_PASSES||3);
const strategy=process.env.SELF_HEAL_STRATEGY||'default';
const runId=`self-heal-${new Date().toISOString().replace(/[-:.]/g,'')}`;
const out=path.resolve('artifacts/diagnostics',runId);
await fs.mkdir(out,{recursive:true});
const checkpoint=path.join(out,'source-checkpoint.json');
const before=await treeHash();
await fs.writeFile(checkpoint,JSON.stringify({runId,strategy,beforeHash:before,createdAt:new Date().toISOString()},null,2));
const steps=['npm run release:autofix:static','npm run release:autofix:routes','npm run release:validate:local'];
const passes=[];let ok=false,lastFailure=null;
for(let pass=1;pass<=max;pass++){
  const rec={pass,strategy,startedAt:new Date().toISOString(),beforeHash:await treeHash(),steps:[]};
  for(const cmd of steps){const r=await run(cmd);rec.steps.push({cmd,...r,classification:classify(r)});if(r.code!==0){lastFailure={cmd,...r,classification:classify(r)};break}}
  rec.afterHash=await treeHash();rec.changed=rec.beforeHash!==rec.afterHash;rec.finishedAt=new Date().toISOString();passes.push(rec);
  if(rec.steps.length===steps.length&&rec.steps.every(x=>x.code===0)){ok=true;break}
}
const after=await treeHash();
const report={runId,strategy,maxPasses:max,beforeHash:before,afterHash:after,changed:before!==after,passes,verdict:ok?'PASS':'FAIL',lastFailure,nextAction:ok?'continue lifecycle':'deployment blocked; preserve checkpoint; rotate strategy and rerun with SELF_HEAL_STRATEGY=<new-strategy>',ownerInterruptionRequired:false};
await fs.writeFile(path.join(out,'remediation-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(out,'remediation-report.md'),`# Autonomous Remediation Report\n\n- Run: ${runId}\n- Strategy: ${strategy}\n- Verdict: ${report.verdict}\n- Passes: ${passes.length}\n- Source changed: ${report.changed}\n- Before hash: ${before}\n- After hash: ${after}\n- Next: ${report.nextAction}\n`);
console.log(`release:self-heal ${report.verdict}`);process.exit(ok?0:1);
function classify(r){const t=`${r.stdout}\n${r.stderr}`;if(/auth|permission|tenant|forbidden|unauthorized/i.test(t))return 'AUTHORIZATION';if(/typecheck|typescript|TS\d+/i.test(t))return 'TYPE_SYSTEM';if(/build|compile|webpack|vite|next/i.test(t))return 'BUILD';if(/test|assert|vitest|playwright/i.test(t))return 'TEST';if(/audit|vulnerab|CVE/i.test(t))return 'SECURITY';return r.code===0?'PASS':'UNKNOWN'}
function run(cmd){return new Promise(resolve=>{const p=spawn(cmd,{shell:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_OPTIONS:process.env.NODE_OPTIONS||'--max-old-space-size=3072'}});let stdout='',stderr='';p.stdout.on('data',d=>{stdout+=d;process.stdout.write(d)});p.stderr.on('data',d=>{stderr+=d;process.stderr.write(d)});p.on('close',code=>resolve({code:code??1,stdout:stdout.slice(-30000),stderr:stderr.slice(-30000)}))})}
async function treeHash(){const files=[];await walk('.');files.sort();const h=crypto.createHash('sha256');for(const f of files){h.update(f);h.update(await fs.readFile(f))}return h.digest('hex');async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(/(^|\/)(node_modules|\.git|artifacts|dist|build|\.next|\.open-next|coverage|playwright-report|test-results)(\/|$)/.test(p))continue;if(e.isDirectory())await walk(p);else files.push(p)}}}
