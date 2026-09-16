const fs = require('fs');
function read(file){ if(!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file,'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const svc=read('services/venue/attendeeLivePermissionService.ts');
assert(svc.includes('Main stage publishing requires crew approval'), 'Main stage attendee publishing must require approval.');
assert(svc.includes('emergencyPublishingDisabled'), 'Crew emergency publishing disable must exist.');
assert(read('app/api/video/livekit-token/route.ts').includes('canAttendeePublishLive'), 'LiveKit token endpoint must be permission-aware.');
// The kill switch lives in the shared room-control forms (crew console, command page, testing console); the panel renders them and the roster's Revoke.
assert(read('components/testing/AttendeeLiveControlPanel.tsx').includes('Revoke') && read('components/testing/AttendeeLiveControlPanel.tsx').includes('<LiveRoomControlForms eventId=') && read('components/moderation/LiveRoomControlForms.tsx').includes('Emergency disable all publishing'), 'Crew panel must expose revoke and kill switch.');
console.log('validate_attendee_live_controls_contract: PASS');
