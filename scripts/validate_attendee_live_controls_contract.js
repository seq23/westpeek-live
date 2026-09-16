const fs = require('fs');
function read(file){ if(!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file,'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const svc=read('services/venue/attendeeLivePermissionService.ts');
assert(svc.includes('Main stage publishing requires crew approval'), 'Main stage attendee publishing must require approval.');
assert(svc.includes('emergencyPublishingDisabled'), 'Crew emergency publishing disable must exist.');
assert(read('app/api/video/livekit-token/route.ts').includes('canAttendeePublishLive'), 'LiveKit token endpoint must be permission-aware.');
// The kill switch lives in the shared room-control forms (crew console, command page, testing console); the panel renders them and the roster's Revoke.
assert(read('components/testing/AttendeeLiveControlPanel.tsx').includes('Revoke') && read('components/testing/AttendeeLiveControlPanel.tsx').includes('=> LiveRoomControlForms({ eventId') && read('components/moderation/LiveRoomControlForms.tsx').includes('Emergency disable all publishing'), 'Crew panel must expose revoke and kill switch.');
// Attendee on-stage controls (16 Sep 2026): an approved attendee gets Turn on camera / Turn on
// microphone / Leave the stage; nothing auto-publishes; a Room allows requests by default with
// approval required; the state line under the player never goes silent.
const controls=read('components/video/AttendeeStageControls.tsx');
for (const token of ['Turn on camera','Turn on microphone','Leave the stage','createLocalVideoTrack','createLocalAudioTrack','permissionHint','stage-local-preview','grant.canPublishVideo && cameraRef.current']) assert(controls.includes(token), `AttendeeStageControls must carry ${token}.`);
const ingressPlayer=read('components/video/LiveKitIngressStagePlayer.tsx');
assert(ingressPlayer.includes('audio={false} video={false}'), 'The stage player must never auto-publish the attendee\'s devices.');
assert(!ingressPlayer.includes('audio={true}') && !ingressPlayer.includes('video={true}'), 'The stage player must never auto-publish the attendee\'s devices.');
const stagePlayer=read('components/video/StagePlayer.tsx');
assert(stagePlayer.includes('<AttendeeStageControls') && stagePlayer.includes('useAttendeeStageStatus('), 'StagePlayer must render the attendee control bar from the polled grant.');
const status=read('services/venue/attendeeStageStatus.ts');
for (const token of ['Want to speak? Request to join the stage','Requested — waiting for the crew','Approved — turn on your camera','Removed by the crew','The crew has closed stage requests for now','Tap Turn on camera']) assert(status.includes(token), `attendeeStageStatus must say: ${token}`);
assert(!status.includes('player above') && !read('components/venue/AttendeeStageJoinControls.tsx').includes('player above'), 'The approved notice must name the next action, not "the player above".');
const defaults=svc.slice(svc.indexOf('export function defaultLiveControlState'), svc.indexOf('export async function getAttendeeLiveControlState'));
assert(defaults.includes('globalCameraEnabled: true') && defaults.includes('globalMicrophoneEnabled: true') && defaults.includes('requestRequired: roomKind === "main_stage"'), 'A new Room must allow attendee camera/mic requests by default, with approval required on the main stage.');
assert(read('app/api/attendee-live/mine/route.ts').includes('getCurrentAttendeeIdentity(eventId)') && !read('app/api/attendee-live/mine/route.ts').includes('searchParams.get("attendeeId")'), '/api/attendee-live/mine must read only the caller\'s own capability.');
// One welcome, dismissed once per event and never shown again; it replaced the coach strip so
// there is never a second orientation thing alongside it (the owner: help boxes do not work).
for (const file of ['components/venue/MainStageExperience.tsx','components/venue/VenueLobbyDashboard.tsx']) assert(read(file).includes('<VenueWelcome'), `${file} must carry the one venue welcome.`);
assert(!fs.existsSync('components/venue/FirstVisitCoachStrip.tsx'), 'FirstVisitCoachStrip was replaced by VenueWelcome; it must not come back alongside it.');
assert(fs.existsSync('tests/e2e/attendee-on-stage-mobile.spec.ts') && read('tests/e2e/attendee-on-stage-mobile.spec.ts').includes('stage-camera-toggle') && read('playwright.config.ts').includes('--use-fake-device-for-media-stream'), 'The phone-width on-stage proof must exist with fake media.');
console.log('validate_attendee_live_controls_contract: PASS');
