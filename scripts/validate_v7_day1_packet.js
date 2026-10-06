const fs = require('fs');

const file = 'docs/AGENCY_EVENT_OS_DAY1_OPERATOR_PACKET.md';
if (!fs.existsSync(file)) throw new Error('Day 1 operator packet missing.');

const s = fs.readFileSync(file, 'utf8');
const lower = s.toLowerCase();

const required = [
  'West Peek Live',
  'Owner',
  'Operator',
  'Crew',
  'Special Guest',
  'Owner / Boss Master Gate',
  'Operator Launchpad',
  'Crew Access',
  '/production-access',
  '/production-access/owner',
  '/production-access/operator',
  '/production-access/crew',
  '/production-access/special-guest',
  'StreamYard',
  'Production feed/source',
  'Primary embedded event engine/distribution',
  'LiveKit',
  'Daily',
  'Zoom',
  'Google Meet',
  'Day 1',
];

const missing = required.filter((token) => !lower.includes(token.toLowerCase()));
if (missing.length) throw new Error(`Day 1 packet missing: ${missing.join(', ')}`);

const staleForbiddenPatterns = [
  /SpeakerGuest-\d{4}!/,
  /SponsorGuest-\d{4}!/,
  /VIPGuest-\d{4}!/,
  /Demo special guest passwords are seeded for training/,
];

const staleFound = staleForbiddenPatterns.filter((pattern) => pattern.test(s));
if (staleFound.length) {
  throw new Error('Day 1 packet contains stale fake guest-password model.');
}


const staleProviderModel = [
  'Primary video provider: Zoom',
  'Primary venue distribution is Zoom',
];
const staleProviderFound = staleProviderModel.filter((token) => s.includes(token));
if (staleProviderFound.length) {
  throw new Error(`Day 1 packet contains stale video provider model: ${staleProviderFound.join(', ')}`);
}

const providerSecretPatterns = [
  /CLOUDFLARE_API_TOKEN\s*=\s*[A-Za-z0-9_-]{20,}/i,
  /LIVEKIT_API_SECRET\s*=\s*\S+/i,
  /DAILY_API_KEY\s*=\s*\S+/i,
  /RESEND_API_KEY\s*=\s*re_/i,
  /ZOOM_MEETING_SDK_SECRET\s*=\s*\S+/i,
  /V5_ACCESS_COOKIE_SECRET\s*=\s*\S+/i,
];

const leakedProviderSecrets = providerSecretPatterns.filter((pattern) => pattern.test(s));
if (leakedProviderSecrets.length) {
  throw new Error('Day 1 packet appears to contain raw provider/API/runtime secrets. Keep provider secrets in the private env vault, not the operator packet.');
}

console.log('validate_v7_day1_packet: PASS');
