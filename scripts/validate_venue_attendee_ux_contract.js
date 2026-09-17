const fs = require("fs");
const path = require("path");

/**
 * The attendee venue, as the owner found it in a real live show on 16 Sep 2026 and as it must stay:
 *
 *  1. The profile card is not in the chat rail, and no chat claims h-full inside a stretched grid
 *     row — that is what painted "Tell us more about you" on top of My Agenda on her phone.
 *  2. No attendee-facing venue surface prints a time in UTC: every one goes through LocalTime or
 *     LocalTimeWindow, which format in the viewer's own clock.
 *  3. Nav markers come from getVenueActivity's real signals; nothing is invented and nothing is a
 *     hard-coded badge.
 *  4. The run of show opens without navigation — the strip is on every venue page, the standalone
 *     route still answers, and no guest surface reads a producer field.
 *  5. Engineer vocabulary stays out of guest copy.
 *  6. Collapsible sections and empty states come from the one shared component each.
 *
 * Hard-fails when it examines nothing.
 */
const failures = [];
let examined = 0;

function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""; }
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}
function fail(message) { failures.push(message); }

const venueComponents = walk("components/venue");
const venueRoutes = walk("app/venue");
const attendeeSurfaces = [...venueComponents, ...venueRoutes];

// ---- 1. the profile card is out of the chat rail, and nothing stretches a rail any more --------
const stage = read("components/venue/MainStageExperience.tsx");
examined += 1;
if (!stage.includes("<MainStageLiveChat")) fail("MainStageExperience must still render the stage chat.");
{
  // The rail is the element holding MainStageLiveChat. The profile panel must not be inside it.
  const railStart = stage.indexOf("<MainStageLiveChat");
  const railEnd = stage.indexOf("</div>", railStart);
  const rail = railStart >= 0 ? stage.slice(railStart, railEnd) : "";
  if (rail.includes("EditAttendeeProfilePanel")) fail("EditAttendeeProfilePanel must not sit in the chat rail; it is a full-width section under the stage.");
  if (!stage.includes("EditAttendeeProfilePanel")) fail("The stage must still offer Tell us more about you.");
  if (!stage.includes("grid items-start")) fail("The stage grid must be items-start so a column never stretches a sibling out of its row.");
}
for (const file of ["components/venue/LiveRoomChat.tsx"]) {
  examined += 1;
  if (/className="[^"]*\bh-full\b/.test(read(file))) fail(`${file} must not claim h-full: inside a stretched grid rail that is what overflowed the row onto My Agenda.`);
}
for (const file of ["components/venue/BreakoutRoomExperience.tsx", "components/venue/SessionRoomExperience.tsx", "components/venue/MainStageExperience.tsx"]) {
  examined += 1;
  const body = read(file);
  if (/<div className="grid gap-6 (lg|xl):grid-cols-/.test(body)) fail(`${file} has a stretching two-column grid; add items-start so the rail sizes to its own content.`);
}

// ---- 2. no attendee-facing time is secretly UTC ------------------------------------------------
const TIME_OWNERS = new Set(["LocalTime.tsx", "LocalTimeWindow.tsx"]);
for (const file of attendeeSurfaces) {
  if (TIME_OWNERS.has(path.basename(file))) continue;
  examined += 1;
  const body = read(file);
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/timeZoneName/.test(withoutComments)) fail(`${file} formats a time with timeZoneName; on a server render that resolves to the Worker's UTC. Use LocalTime or LocalTimeWindow.`);
  if (/\bUTC\b/.test(withoutComments)) fail(`${file} prints UTC in attendee-facing copy.`);
  if (/formatSessionWindow\(/.test(withoutComments)) fail(`${file} uses formatSessionWindow; attendee surfaces render a window through LocalTimeWindow.`);
}

// ---- 3. nav markers are real signals only ------------------------------------------------------
examined += 1;
const nav = read("components/venue/VenueNav.tsx");
if (!nav.includes("navMarkerFor(item.surface, activity)")) fail("VenueNav must derive every marker from navMarkerFor, never from a literal badge.");
if (/data-nav-marker=[^>]*>\s*(Live|Open|New)\s*</.test(nav)) fail("VenueNav must not hard-code a marker label.");
examined += 1;
const activity = read("services/venue/venueActivityService.ts");
for (const token of ["export async function getVenueActivity", "export function navMarkerFor", "EMPTY_VENUE_ACTIVITY"]) {
  if (!activity.includes(token)) fail(`venueActivityService missing ${token}`);
}
// A zero is never a marker: every count branch is guarded by > 0, and networking by the crew's own flag.
for (const guard of ['activity.boothCount > 0', 'activity.breakoutsOpen > 0', 'activity.replaysReady > 0', 'activity.peopleListed > 0', 'activity.networkingOpen']) {
  if (!activity.includes(guard)) fail(`navMarkerFor must gate its marker on ${guard}`);
}
examined += 1;
// The activity read moved to the per-request chrome cache when the command bar and the nav were
// put into one sticky stack (work/venue-chrome). Same guarantee, one owner: the layout renders the
// nav and the shell reads the same cached answer, and a dead read still costs the markers only.
if (!read("services/venue/venueChromeData.ts").includes("getVenueActivity(model).catch(() => EMPTY_VENUE_ACTIVITY)")) fail("The chrome data read must take venue activity fail-soft: a dead read costs the markers, never the page.");
if (!read("components/venue/VenuePageShell.tsx").includes("venueChromeData(model.eventId)")) fail("The shell must reach venue activity through the one cached chrome read, or the probe runs twice per page.");

// ---- 4. the run of show opens without leaving the page ------------------------------------------
examined += 1;
const shell = read("components/venue/VenuePageShell.tsx");
if (!shell.includes("<RunOfShowStrip")) fail("Every venue page must carry the run of show strip.");
if (!shell.includes("attendeeRunOfShowView")) fail("The shell must read the attendee-safe run of show projection.");
if (!shell.includes("runOfShow?.total")) fail("The strip must render nothing when there is no schedule, never an error bar.");
examined += 1;
if (!fs.existsSync("app/venue/[eventId]/run-of-show/page.tsx")) fail("The standalone run of show route must keep working for a direct hit.");
if (!read("AUTHENTICATED_ROUTE_MANIFEST.md").includes("`/venue/[eventId]/run-of-show`")) fail("The run of show route must stay in the route ledger.");
examined += 1;
const projection = read("services/run-of-show/attendeeRunOfShow.ts");
for (const token of ["export function attendeeRunOfShowView", "networking:"]) if (!projection.includes(token)) fail(`attendeeRunOfShow projection missing ${token}`);
for (const leak of ["technicalCues", "producerNotes", "backupPlan", "emergencyNotes", "liveNotes", "internalNotes"]) {
  if (projection.includes(leak)) fail(`The attendee run of show projection must not carry ${leak}.`);
  for (const guestFile of ["components/venue/RunOfShowStrip.tsx", "components/venue/AttendeeRunOfShow.tsx"]) {
    examined += 1;
    if (read(guestFile).includes(leak)) fail(`${guestFile} must not read ${leak}.`);
  }
}

// ---- 5. no engineer vocabulary in front of a guest ---------------------------------------------
const JARGON = [
  ["identity state", "permission-model vocabulary"],
  ["access permission", "permission-model vocabulary"],
  ["Room-scoped chat", "an internal identifier read out to guests"],
  ["attendee-safe", "our word for a producer's idea of the schedule"],
  ["resolver", "an implementation detail"],
  ["Resolve Event", "an implementation detail as a button label"],
];
for (const file of [...attendeeSurfaces, "app/join/page.tsx"]) {
  examined += 1;
  // The copy, not the comments that explain why the copy reads the way it does, and not class names.
  const copy = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/className=\{?"[^"]*"/g, "")
    .replace(/^\s*import .*$/gm, "");
  for (const [phrase, why] of JARGON) {
    if (new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(copy)) fail(`${file} shows "${phrase}" to a guest (${why}).`);
  }
  if (copy.includes("—")) fail(`${file} uses an em-dash in body copy.`);
}

// ---- 6. one shared component each ---------------------------------------------------------------
examined += 1;
for (const required of ["components/venue/VenueSection.tsx", "components/venue/VenueEmptyState.tsx", "components/venue/RegisterToTakePart.tsx", "components/venue/RunOfShowStrip.tsx", "components/shared/LocalTimeWindow.tsx"]) {
  if (!fs.existsSync(required)) fail(`Missing shared component ${required}`);
}
if (!read("components/venue/VenueSection.tsx").includes("motion-safe:transition-transform")) fail("VenueSection must only animate its chevron when the viewer has not asked for reduced motion.");
if (!read("components/venue/VenueSection.tsx").includes("localStorage")) fail("VenueSection must remember its open state per viewer.");
// Every long secondary section uses it rather than hand-rolling a <details>.
for (const file of ["components/venue/EditAttendeeProfilePanel.tsx", "components/venue/MyAgendaPanel.tsx", "components/venue/MainStageAgendaStrip.tsx", "components/venue/VenueHelpCenter.tsx"]) {
  examined += 1;
  if (!read(file).includes("VenueSection")) fail(`${file} must collapse through the shared VenueSection.`);
}
// Every list that can come back empty says something.
for (const file of ["components/venue/ExpoDirectory.tsx", "components/venue/PeopleDirectory.tsx", "components/venue/ReplayCenter.tsx", "components/venue/SessionDirectory.tsx", "components/venue/VenueLobbyDashboard.tsx", "app/venue/[eventId]/breakouts/page.tsx"]) {
  examined += 1;
  const body = read(file);
  if (!body.includes("VenueEmptyState") && !body.includes("VenueBrowse")) fail(`${file} must render the shared empty state instead of a blank list.`);
}
// The tell-us-more anchor and its testids survived the move out of the chat rail.
examined += 1;
const profilePanel = read("components/venue/EditAttendeeProfilePanel.tsx");
for (const token of ['id="tell-us-more"', 'testId="attendee-profile-panel"', 'data-testid="tell-us-more-progress"', 'data-testid="tell-us-more-save"', "tellUsMoreProgressFor(profile, questions)"]) {
  if (!profilePanel.includes(token)) fail(`EditAttendeeProfilePanel lost ${token} in the move out of the chat rail.`);
}
if (!read("components/venue/VenueHeader.tsx").includes("lobby#tell-us-more")) fail("The header link that jumps to Tell us more must keep working.");
if (!read("components/venue/VenueSection.tsx").includes("hashchange")) fail("VenueSection must open itself when the page is targeted at its anchor, or the header link lands on a closed section.");

examined += 1;
for (const file of ["components/venue/ExpoDirectory.tsx", "components/venue/PeopleDirectory.tsx", "components/venue/ReplayCenter.tsx", "components/venue/SessionDirectory.tsx"]) {
  examined += 1;
  if (!read(file).includes("VenueBrowse")) fail(`${file} must use the shared BROWSE archetype, not its own heading block.`);
}
// VenuePageShell owns the one header; a page that renders its own is how ten layouts start again.
for (const file of venueRoutes) {
  examined += 1;
  const body = read(file);
  if (/<header[\s>]/.test(body)) fail(`${file} hand-rolls a header; the venue has exactly one, in VenuePageShell.`);
  if (body.includes("<VenueHeader")) fail(`${file} must reach the header through VenuePageShell, never directly.`);
}

// ---- 7. watching is open; registering is what lets a person take part ---------------------------
examined += 1;
const tokenRoute = read("app/api/video/livekit-token/route.ts");
if (!tokenRoute.includes("WATCHABLE_ROOMS")) fail("The video token route must serve a watch-only token to a viewer with no attendee session.");
if (!tokenRoute.includes('displayName = "Guest"')) fail("An anonymous viewer's token must be issued as a guest, with no publish permission.");
examined += 1;
// Since 0046 the redirect also carries the old code when the person arrived on one we replaced, so
// an out-of-date invitation goes straight in as well and is explained on arrival. Still one hop.
if (!read("app/join/page.tsx").includes("redirect(withSupersededCode(resolution.destination, resolution.supersededCode))")) fail("A join link with a code that resolves must redirect straight to the show, not render a Continue card - including a code we have since replaced.");

if (examined < 40) fail(`validate_venue_attendee_ux_contract examined only ${examined} things; it must not pass on an empty loop.`);

if (failures.length) {
  console.error("validate_venue_attendee_ux_contract: FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`validate_venue_attendee_ux_contract: PASS — ${examined} checks across the attendee venue.`);
