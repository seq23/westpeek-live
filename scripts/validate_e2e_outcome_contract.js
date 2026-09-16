const fs = require('fs');
const required = [
  'docs/E2E_OUTCOME_TESTING_STANDARD.md',
  'docs/PERSONA_ROUTE_OUTCOME_MAP.md',
  'data/testing/cta-promise-registry.json',
  'data/testing/persona-route-outcomes.json',
  'tests/e2e/helpers/persona.ts',
  'tests/e2e/helpers/outcomeAssertions.ts',
  'tests/e2e/persona-outcome-promises.spec.ts',
  'tests/e2e/attendee-registration-outcome.spec.ts',
  'tests/e2e/attendee-venue-identity.spec.ts',
  'tests/e2e/access-boundary-outcomes.spec.ts',
  'tests/e2e/stream-failover-outcomes.spec.ts',
  'tests/e2e/attendee-live-participation-outcomes.spec.ts',
  'tests/e2e/deployed-outcome-smoke.spec.ts',
  'scripts/run_predeploy_playwright.js',
  'docs/testing/PREDEPLOY_PLAYWRIGHT_E2E.md'
];
const failures = required.filter((file) => !fs.existsSync(file)).map((file) => `Missing ${file}`);
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
const suites = {
  'tests/e2e/attendee-registration-outcome.spec.ts': ['company', 'registration-agenda-planner', 'cookie', 'my-agenda', 'attendee-profile-panel'],
  'tests/e2e/attendee-venue-identity.spec.ts': ['main-stage', 'breakout', 'networking', 'help', 'people', 'my-agenda'],
  'tests/e2e/access-boundary-outcomes.spec.ts': ['speaker', 'sponsor', 'crew', 'operator', 'admin', 'publish', 'restricted'],
  'tests/e2e/stream-failover-outcomes.spec.ts': ['pre-stream', '4-second', 'StreamYard', 'LiveKit', 'Daily', 'switching', 'private'],
  'tests/e2e/attendee-live-participation-outcomes.spec.ts': ['crew', 'approval', 'revoke', 'publish'],
  'tests/e2e/persona-outcome-promises.spec.ts': ['public', 'protected', 'auth', 'crew', 'attendee', 'hidden'],
};
for (const [file, tokens] of Object.entries(suites)) {
  const body = read(file).toLowerCase();
  for (const token of tokens) if (!body.includes(token.toLowerCase())) failures.push(`${file} missing outcome coverage token: ${token}`);
}
if (failures.length) { console.error('E2E OUTCOME CONTRACT FAIL\n' + failures.map(f => `- ${f}`).join('\n')); process.exit(1); }

const config = read('playwright.config.ts');
for (const token of ['webServer', 'PLAYWRIGHT_LOCAL_E2E', 'AGENCY_EVENT_OS_RUNTIME_STORE', 'SUPABASE_SERVICE_ROLE_KEY', 'VIDEO_PROVIDER']) {
  if (!config.includes(token)) failures.push(`playwright.config.ts missing deterministic local E2E token: ${token}`);
}
const runner = read('scripts/run_predeploy_playwright.js');
for (const token of ['PLAYWRIGHT_DEPLOYED', 'PLAYWRIGHT_BASE_URL', 'AGENCY_EVENT_OS_RUNTIME_STORE', 'VIDEO_PROVIDER', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!runner.includes(token)) failures.push(`scripts/run_predeploy_playwright.js missing safe env token: ${token}`);
}
if (failures.length) { console.error('E2E OUTCOME CONTRACT FAIL\n' + failures.map(f => `- ${f}`).join('\n')); process.exit(1); }
console.log('E2E OUTCOME CONTRACT PASS — static coverage only; Playwright must prove behavior.');

