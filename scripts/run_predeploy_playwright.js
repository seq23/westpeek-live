#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { day1Default } = require('./lib/day1AccessDefaults');

const root = process.cwd();
const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
if (!fs.existsSync(cli)) {
  console.error('PREDEPLOY PLAYWRIGHT BLOCKED: node_modules/@playwright/test/cli.js is missing. Run npm ci in this temporary ZIP workspace or copy a complete node_modules first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const suite = args[0] && !args[0].startsWith('-') ? args.shift() : 'all';
const suiteMap = {
  surface: ['tests/e2e/public-frontdoor.spec.ts', 'tests/e2e/visitor-full-journey.spec.ts'],
  transactional: ['tests/e2e/transactional-full-buffett.spec.ts', 'tests/e2e/attendee-registration-outcome.spec.ts', 'tests/e2e/attendee-venue-identity.spec.ts'],
  outcome: ['tests/e2e/persona-outcome-promises.spec.ts', 'tests/e2e/access-boundary-outcomes.spec.ts', 'tests/e2e/stream-failover-outcomes.spec.ts', 'tests/e2e/attendee-live-participation-outcomes.spec.ts'],
  all: [],
};

if (!Object.prototype.hasOwnProperty.call(suiteMap, suite)) {
  console.error(`Unknown predeploy Playwright suite: ${suite}`);
  console.error(`Allowed suites: ${Object.keys(suiteMap).join(', ')}`);
  process.exit(1);
}

const port = process.env.PORT || '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const runtimePath = process.env.AGENCY_EVENT_OS_RUNTIME_STORE_PATH || path.join(root, '.runtime-data', 'local-playwright-runtime.json');
fs.mkdirSync(path.dirname(runtimePath), { recursive: true });

const safeEnv = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=3072',
  PLAYWRIGHT_BASE_URL: baseURL,
  PLAYWRIGHT_DEPLOYED: '0',
  PLAYWRIGHT_LOCAL_E2E: '1',
  NEXT_PUBLIC_APP_URL: baseURL,
  AGENCY_EVENT_OS_RUNTIME_STORE: 'file',
  AGENCY_EVENT_OS_RUNTIME_STORE_PATH: runtimePath,
  ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION: 'true',
  VIDEO_PROVIDER: 'mock',
  ALLOW_MOCK_VIDEO_PROVIDER_IN_PRODUCTION: 'true',
  DAILY_FALLBACK_ENABLED: 'false',
  DAILY_STAGE_FALLBACK_REQUIRES_TOKEN: 'true',
  STREAMYARD_PRIMARY_ENABLED: 'true',
  STAGE_STREAM_DEFAULT_SOURCE: 'LIVEKIT_INGRESS',
  V5_ACCESS_COOKIE_SECRET: day1Default('V5_ACCESS_COOKIE_SECRET', 'local-playwright-e2e-cookie-secret-1234567890'),
  CREW_ACCESS_PASSWORD: day1Default('CREW_ACCESS_PASSWORD'),
  OPERATOR_LAUNCHPAD_PASSWORD: day1Default('OPERATOR_LAUNCHPAD_PASSWORD'),
  AUTH_SESSION_COOKIE_NAME: process.env.AUTH_SESSION_COOKIE_NAME || 'agency_event_os_session',
  V5_CREW_COOKIE_NAME: process.env.V5_CREW_COOKIE_NAME || 'wpl_crew_access',
  V5_OPERATOR_COOKIE_NAME: process.env.V5_OPERATOR_COOKIE_NAME || 'wpl_operator_access',
  V5_SPECIAL_GUEST_COOKIE_NAME: process.env.V5_SPECIAL_GUEST_COOKIE_NAME || 'wpl_guest_access',
  EVENT_DEMO_SPEAKER_CODE: day1Default('EVENT_DEMO_SPEAKER_CODE'),
  EVENT_DEMO_SPONSOR_CODE: day1Default('EVENT_DEMO_SPONSOR_CODE'),
  EVENT_DEMO_VIP_CODE: day1Default('EVENT_DEMO_VIP_CODE'),
  LIVEKIT_URL: '',
  LIVEKIT_API_KEY: '',
  LIVEKIT_API_SECRET: '',
  LIVEKIT_WEBHOOK_SECRET: '',
  DAILY_API_KEY: '',
  DAILY_DOMAIN: '',
};

const finalArgs = ['test', ...suiteMap[suite], ...args];
console.log('Agency Event OS predeploy Playwright runner');
console.log(`Suite: ${suite}`);
console.log(`Base URL: ${baseURL}`);
console.log(`Runtime store: ${runtimePath}`);
console.log('Mode: local predeploy, file runtime, mock video, no database/provider secrets');
console.log(`Command: node ${path.relative(root, cli)} ${finalArgs.join(' ')}`);

const result = spawnSync(process.execPath, [cli, ...finalArgs], {
  cwd: root,
  env: safeEnv,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
