#!/usr/bin/env node
const cp = require('node:child_process');
const os = require('node:os');

function run(command, env = process.env) {
  const result = cp.spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env,
  });
  if (result.error) {
    console.error(`build_cloudflare_or_next: failed to start ${command}`);
    console.error(result.error.message || result.error);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

function commandForPid(pid) {
  if (!pid || pid <= 1 || os.platform() === 'win32') return '';
  try {
    return cp.execFileSync('ps', ['-p', String(pid), '-o', 'ppid=', '-o', 'command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function ancestorContainsOpenNext() {
  let pid = process.ppid;
  const seen = new Set();
  for (let depth = 0; pid && pid > 1 && depth < 12 && !seen.has(pid); depth += 1) {
    seen.add(pid);
    const raw = commandForPid(pid);
    if (!raw) return false;
    if (/opennextjs-cloudflare|@opennextjs\/cloudflare|open-next|opennext/i.test(raw)) return true;
    const match = raw.match(/^\s*(\d+)\s+/);
    pid = match ? Number(match[1]) : 0;
  }
  return false;
}

/**
 * No override flag: OpenNext refuses a Next.js major two years after its release (Next 15 stopped
 * building on 21 Oct 2026), and the lasting answer was to move to Next 16, not to force the build.
 * scripts/validate_next_version_floor.mjs fails if the flag comes back or next drops below 16.
 */

const nextOnly = process.env.AGENCY_EVENT_OS_NEXT_BUILD_ONLY === '1' || ancestorContainsOpenNext();

if (nextOnly) {
  console.log('build_cloudflare_or_next: OpenNext child build detected; running plain Next build.');
  run('next build');
}

console.log('build_cloudflare_or_next: running OpenNext Cloudflare build so npm run build emits deployable .open-next output.');
run('opennextjs-cloudflare build', { ...process.env, AGENCY_EVENT_OS_NEXT_BUILD_ONLY: '1' });
