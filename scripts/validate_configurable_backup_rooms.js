const fs = require("fs");
/**
 * The bottom two rungs of the show-day ladder, set by a person (17 Sep 2026).
 *
 * The ladder has five rungs and the bottom two could not be set up at all: Zoom read a meeting
 * number out of TIER4_ZOOM_MEETING_NUMBER and Google Meet read a URL out of
 * GOOGLE_MEET_MANAGED_FALLBACK_URL, both fixed at deploy time. So in the one situation those rungs
 * exist for — the feed is down, the show is running, the crew is walking down the ladder — there was
 * no way to put a meeting in. This validator holds the six things that make the fix honest:
 *
 *   1. readiness follows the SAVED value, and a rung with no meeting refuses the move naming what
 *      is missing — on the server, not only on the disabled button;
 *   2. what is typed in is validated, and a refusal is a sentence a person can act on;
 *   3. a meeting saved mid-show reaches everyone already watching with no reload, because the stage
 *      state folds the saved row in on every READ;
 *   4. Zoom keeps attendees inside the venue and is white-labelled as far as Zoom's SDK allows;
 *   5. Google Meet — the one rung that leaves our page — shows a panel saying where the show went
 *      and what does not travel with them, and never a silent redirect;
 *   6. "Email everyone the new link" is a LINK to the composer. Nothing on the crew card can send.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
const failures = [];
function check(file, tokens) {
  let body;
  try { body = read(file); } catch (error) { failures.push(error.message); return ""; }
  examined += 1;
  const missing = tokens.filter((token) => !body.includes(token));
  if (missing.length) failures.push(`${file} missing: ${missing.join(" | ")}`);
  return body;
}
function must(condition, message) { if (!condition) failures.push(message); }
/** Comments describe the rule; only the code can break it. */
function codeOnly(body) { return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); }

// 1 · readiness is the saved value, and the refusal is enforced at the server ------------------
const readiness = check("lib/video/fallbackReadiness.ts", ["BackupRoomValues", "export function ladderReadiness", "export function rungReadiness"]);
must(/ladderReadiness\(env: Env = process\.env, backup\?: BackupRoomValues\)/.test(readiness), "ladderReadiness must accept the event's saved Backup rooms row: the bottom two rungs stopped being an environment question.");
must(/const zoom = Boolean\(\(backup\?\.zoomMeetingNumber/.test(readiness), "The Zoom rung must be ready because a meeting is SAVED for this event, not because a Worker variable is set.");
must(/const meet = Boolean\(\(backup\?\.googleMeetUrl/.test(readiness), "The Google Meet rung must be ready because a link is SAVED for this event.");
must(/source: "ZOOM"[\s\S]{0,400}?Backup rooms card/.test(readiness), "An unconfigured Zoom rung must name what is missing and where to put it.");
must(/source: "GOOGLE_MEET"[\s\S]{0,400}?Backup rooms card/.test(readiness), "An unconfigured Google Meet rung must name what is missing and where to put it.");

const actions = check("lib/actions/stageStreamActions.ts", ["export async function saveBackupRoomsAction", "saveEventBackupRoom", "getEventBackupRoom"]);
must(/rungReadiness\(target, process\.env, await getEventBackupRoom\(eventId, stageId\)\)/.test(actions), "The server-side refusal of a move down must read THIS event's saved rooms, or a crafted request could send the whole room to a rung with no meeting on it.");
must(/if \(!rung\.ready\) throw new Error\(`Refused: \$\{rung\.reason\}`\)/.test(actions), "A move to an unconfigured rung must be refused with the reason, not silently allowed.");
must(actions.includes("const auth = await requireControl(eventId);"), "Saving the backup rooms must be gated by the same go_live control as moving the room down the ladder.");
must(/savedBy = auth\.actorRole === "crew" \? `crew:\$\{auth\.crewRole\}` : auth\.actorRole/.test(actions), "The save must record the ROLE that pressed it, never a person's name.");

// 2 · what a person types is validated, and refused in words -----------------------------------
const types = check("types/backupRoom.ts", ["export function parseZoomMeetingNumber", "export function parseZoomPasscode", "export function parseGoogleMeetUrl", "EventBackupRoomRecord", "BackupRoomValues"]);
must(types.includes("meet.google.com"), "A Google Meet link must be checked against Meet's own host; this rung sends attendees off our page and a wrong link is the worst mistake on the ladder.");
must(/\{ ok: true, value: undefined \}/.test(types), "Both fields are optional: an empty box is a valid save, not a refusal.");
for (const [token, why] of [["9, 10 or 11 digits", "the length rule"], ["only digits", "the not-a-number case"], ["three-part code", "a Meet link with no room code"]]) {
  must(types.includes(token), `A refusal must say what is wrong in words — ${why} has no sentence a crew member can act on.`);
}

const service = check("services/video/backupRoomService.ts", ["export async function getEventBackupRoom", "export async function saveEventBackupRoom", "houseZoomMeetingNumber", "houseGoogleMeetUrl"]);
must(/if \(!zoom\.ok\) return \{ ok: false, reason: `Zoom meeting number: \$\{zoom\.reason\}` \}/.test(service), "A refused field must come back naming the field, so the card can say which box is wrong.");
must(service.includes("zoomPasscode: zoom.value ? passcode.value : undefined"), "A passcode with no meeting behind it must not be stored: the card would read as set up when the rung is not.");
// Nothing else in the app may go back to reading the two variables directly.
for (const file of ["components/stage/BackupRoomsCard.tsx", "components/testing/StreamYardIngressPanel.tsx", "components/video/StagePlayer.tsx"]) {
  const body = check(file, []);
  must(!/TIER4_ZOOM_MEETING_NUMBER|GOOGLE_MEET_MANAGED_FALLBACK_URL|GOOGLE_MEET_EMERGENCY_URL/.test(body), `${file} must not read the Zoom or Meet Worker variables: the event's saved row is the source of truth now.`);
}

// 3 · a meeting typed in mid-show reaches everyone already watching, with no reload -------------
const stageState = check("services/video/stageStreamStateService.ts", ["async function withBackupRoom", "getEventBackupRoom"]);
must(/if \(existing\) return withBackupRoom\(/.test(stageState), "The saved rooms must be folded onto the stage state on every READ, so the attendee player's poll picks a new meeting up without a reload.");
must(/zoomMeetingPasscode: backup\.zoomPasscode/.test(stageState), "The meeting's passcode must travel with the meeting or the embedded room cannot be joined.");
const publicState = check("types/stageStream.ts", ["zoomMeetingPasscode"]);
must(/zoomMeetingPasscode: state\.zoomMeetingPasscode/.test(publicState), "The attendee's own browser joins the embedded Zoom room, so the passcode has to reach the public state.");
const player = check("components/video/StagePlayer.tsx", ["zoomMeetingPassword: state.zoomMeetingPasscode", "GoogleMeetFallbackStagePlayer", "ZoomEmbeddedRoom"]);
must(/window\.setInterval\(hydrate, 10_000\)/.test(player), "The stage player must keep polling the state: that poll is what makes a mid-show change take effect for people already watching.");

// 4 · Zoom stays inside the venue, white-labelled as far as the SDK allows ----------------------
const zoomRoom = check("components/video/ZoomEmbeddedRoom.tsx", ["zoomAppRoot", "meetingInfo: []", "toolbar: { buttons: [] }", "west-peek-zoom-room"]);
must(zoomRoom.includes("stay inside the event venue"), "The Zoom rung keeps attendees on the West Peek page and the card must say so.");
must(!/window\.location|location\.href/.test(codeOnly(zoomRoom)), "Zoom is embedded, never a redirect: attendees keep our chrome, our chat and our roster.");

// 5 · Google Meet leaves the venue, so it is a panel that says so -------------------------------
const meetPanel = check("components/video/GoogleMeetFallbackStagePlayer.tsx", ["google-meet-moved-panel", "google-meet-open-link", "The show has moved"]);
must(/do not come with you/.test(meetPanel), "The Meet panel must say plainly that the chat, the attendee list and networking do not travel with them.");
must(!/window\.location|location\.href|router\.push|redirect\(/.test(codeOnly(meetPanel)), "Moving down to Meet must never be a silent redirect: the attendee is shown where the show went and chooses to open it.");
must(/if the stream comes back, the show returns here and this panel disappears/i.test(meetPanel), "Moving back up must be promised where the attendee reads it, because it is what the poll actually does.");

// 6 · the crew card: honest about the rungs, and it cannot send -------------------------------
const card = check("components/stage/BackupRoomsCard.tsx", [
  "backup-rooms-card",
  "backup-rooms-zoom-number",
  "backup-rooms-zoom-passcode",
  "backup-rooms-meet-url",
  "backup-rooms-zoom-readiness",
  "backup-rooms-meet-readiness",
  "saveBackupRoomsAction",
  "ComposeLink",
]);
must(/<GatedForm viewer=\{viewer\} action="go_live"/.test(card), "The card's controls must be gated on go_live: owner, operator, and crew whose role may go live.");
must(!/sendGroupEmail|groupEmailService|sendGroupEmailAction/.test(card), "The crew card must not be able to send email. It offers a LINK to the composer; a person presses Send on the screen that shows who it is going to.");
must(card.includes("audience=\"attendees\""), "\"Email everyone the new link\" must be addressed to the event's registered attendees.");
must(/cannot be brought onto the West Peek stage/.test(card), "No rung may claim a capability it does not have: the card must say, where a producer reads it before choosing, that neither Zoom nor Meet can bring an attendee onto the West Peek stage.");
must(/Chat, the attendee list, stage requests and speed networking do not travel with them/.test(card), "The Meet rung leaves our page and the card must say what stops working.");

const composeLink = check("components/email/ComposeLink.tsx", ["subject", "body", "/app/email/compose?"]);
must(!/action=|formAction|fetch\(/.test(codeOnly(composeLink)), "ComposeLink must stay a link: a prefilled message is a head start on the typing, never a shortcut past the press.");
const composer = check("components/email/EmailComposer.tsx", ["defaultValue={String(query?.subject", "defaultValue={String(query?.body"]);
must(/<input type="hidden" name="subject"[\s\S]{0,200}<input type="hidden" name="body"/.test(composer), "Re-resolving the audience must not throw away a prefilled message, or the crew deck's offer empties itself on the first click.");

// 7 · the surfaces it is reachable from, and the row underneath it -----------------------------
check("components/testing/StreamYardIngressPanel.tsx", ["BackupRoomsCard", "ladderReadiness(process.env, backup)"]);
check("components/stage/GoLiveCard.tsx", ["BackupRoomsCard"]);
check("app/app/events/[eventId]/video/main-stage/page.tsx", ["BackupRoomsCard"]);

const migration = check("db/migrations/0045_event_backup_rooms.sql", [
  "create table if not exists public.event_backup_rooms",
  "zoom_meeting_number",
  "zoom_passcode",
  "google_meet_url",
  "primary key (event_id, stage_id)",
]);
const mirror = "supabase/migrations/20260917130000_event_backup_rooms.sql";
must(fs.existsSync(mirror), `${mirror} is missing; the migration would never run in production.`);
if (fs.existsSync(mirror)) { examined += 1; must(read(mirror) === migration, "The 0045 mirror drifted from the canonical migration."); }
const map = check("types/runtimeEvent.ts", ["event_backup_rooms: EVENT_BACKUP_ROOMS_MIGRATION_FILE"]);
must(map.includes("0045_event_backup_rooms.sql"), "event_backup_rooms must be registered against the migration that creates it, or /api/runtime/health cannot probe it.");
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) {
  check(store, ["getEventBackupRoom", "setEventBackupRoom"]);
}
check("tests/unit/backupRooms.test.ts", [
  "saving a Zoom meeting makes that rung configured",
  "an invalid meeting number is refused with a readable reason",
  "a meeting saved mid-show reaches the attendee's next poll",
  "moving down to Meet carries the link the crew saved, and moving back up clears it",
  "one row per recipient, and only on a press",
]);

// Rule 0: this must never pass on an empty loop.
if (examined < 16) failures.push(`validate_configurable_backup_rooms examined only ${examined} files; the rule would pass on an empty loop.`);
if (failures.length) {
  console.error("validate_configurable_backup_rooms: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_configurable_backup_rooms: PASS — ${examined} files examined; Zoom and Google Meet are configured per event by a person, each rung's readiness follows the saved meeting and an unconfigured rung refuses the move on the server naming what is missing, a value that is not a meeting is refused in words, a meeting saved mid-show reaches everyone already watching through the stage poll, Zoom stays embedded inside the venue with Zoom's meeting-info panel suppressed, Meet shows a panel saying where the show went and what does not travel, and "Email everyone the new link" is a link to the composer where a person presses Send.`);
