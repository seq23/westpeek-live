const fs = require('fs');

function fail(message) {
  console.error(`validate_transactional_full_buffett_e2e_contract: FAIL — ${message}`);
  process.exit(1);
}
function read(file) {
  if (!fs.existsSync(file)) fail(`missing ${file}`);
  return fs.readFileSync(file, 'utf8');
}

const files = [
  'docs/TRANSACTIONAL_FULL_BUFFETT_E2E_MATRIX.md',
  'tests/e2e/transactional-full-buffett.spec.ts',
  'tests/e2e/helpers/runtimeTrace.ts',
  'lib/actions/networkingActions.ts',
  'lib/actions/runOfShowActions.ts',
  'components/venue/SpeedNetworkingQueuePanel.tsx',
  'components/run-of-show/LiveRunOfShowControls.tsx',
  'components/run-of-show/LiveRunOfShowDashboard.tsx',
  'app/app/events/[eventId]/run-of-show/page.tsx',
];
for (const file of files) read(file);

const matrix = read('docs/TRANSACTIONAL_FULL_BUFFETT_E2E_MATRIX.md').toLowerCase();
for (const term of ['producer setup', 'run of show', 'testing console', 'visitor registration', 'attendee venue', 'matchmaking', 'video', 'production boundary', 'clicks', 'submissions', 'persistence']) {
  if (!matrix.includes(term)) fail(`matrix missing ${term}`);
}

const spec = read('tests/e2e/transactional-full-buffett.spec.ts').toLowerCase();
for (const term of [
  'resetruntimetracefiles',
  'expecteventuallyruntime',
  'expecteventuallyruntimeevent',
  '/app/events/new',
  'create-event-submit',
  'runtime event row should persist',
  '/app/events/demo/run-of-show',
  'mark live',
  '/events/demo/register',
  'submit registration',
  '/venue/event-summit/help',
  'send help request',
  '/venue/event-summit/networking',
  'join queue',
  'selectnextspeednetworkingpair',
  '/api/video/livekit-token',
  '/api/video/daily-token',
  '/api/video/zoom-signature',
  '/admin/testing/demo',
]) {
  if (!spec.includes(term)) fail(`transactional spec missing ${term}`);
}

const queue = read('components/venue/SpeedNetworkingQueuePanel.tsx');
if (!queue.includes('joinSpeedNetworkingQueueAction')) fail('queue panel must use real server action');
if (!queue.includes('type="submit"')) fail('queue panel must submit, not only link');

const controls = read('components/run-of-show/LiveRunOfShowControls.tsx').toLowerCase();
if (!controls.includes('recordrunofshowcontrolaction')) fail('run-of-show controls must use real server action');
if (!controls.includes('mark live')) fail('run-of-show controls missing Mark live');

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts['test:e2e:transactional']) fail('package.json missing test:e2e:transactional');
if (!pkg.scripts['validate:transactional-e2e-contract']) fail('package.json missing validate:transactional-e2e-contract');
if (!pkg.scripts['validate:deploy-parity'].includes('validate_transactional_full_buffett_e2e_contract.js')) fail('validate:deploy-parity missing transactional validator');

console.log('validate_transactional_full_buffett_e2e_contract: PASS');
