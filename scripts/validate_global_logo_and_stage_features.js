const fs = require("fs");

function fail(message) {
  console.error("validate_global_logo_and_stage_features: FAIL — " + message);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail("missing " + file);
  return fs.readFileSync(file, "utf8");
}

const globalLogo = read("components/brand/GlobalWestPeekLogoLink.tsx");
if (!globalLogo.includes("return null")) fail("Global floating West Peek logo overlay must render null.");

const legalFooter = read("components/legal/LegalFooter.tsx");
for (const term of ["https://westpeek.live", "https://productions.joinwestpeek.com/", "mailto:info@westpeek.ventures"]) {
  if (!legalFooter.includes(term)) fail("LegalFooter missing " + term);
}

const stage = read("components/venue/MainStageExperience.tsx");
for (const term of ["MainStageLiveChat", "MainStageAgendaStrip", "StagePlayer"]) {
  if (!stage.includes(term)) fail("Main stage missing " + term);
}
if (stage.includes("FloatingHelpButton")) fail("Main stage must not render floating Help over player/chat.");

const floatingHelp = read("components/venue/FloatingHelpButton.tsx");
if (!floatingHelp.includes("/venue/${eventId}/help")) fail("FloatingHelpButton must route to event Help.");

const people = read("components/venue/PeopleDirectoryCard.tsx");
for (const term of ["reasonForAttending", "interestingFact", "personalWebsite", "socialLinks"]) {
  if (!people.includes(term)) fail("People profile cards missing " + term);
}

// The running order opens IN PLACE. "Open Run of Show" used to navigate an attendee off a live
// broadcast (the owner, 16 Sep 2026): the agenda strip links to the on-page panel, the shell
// renders that panel on every venue page, and the standalone route still answers for a direct hit.
const agenda = read("components/venue/MainStageAgendaStrip.tsx");
if (!agenda.includes("/run-of-show")) fail("Main stage agenda strip must still offer the full running order page");
const shell = read("components/venue/VenuePageShell.tsx");
if (!shell.includes("<RunOfShowStrip")) fail("Every venue page must carry the run of show strip through VenuePageShell");
const strip = read("components/venue/RunOfShowStrip.tsx");
for (const token of ['data-testid="run-of-show-strip"', "run-of-show-strip-now", "attendeeRunOfShowView"]) {
  if (!strip.includes(token) && !read("components/venue/VenuePageShell.tsx").includes(token)) fail("Run of show strip missing " + token);
}
// Guest surfaces read the attendee-safe projection, never the producer snapshot.
for (const guestFile of ["components/venue/RunOfShowStrip.tsx", "components/venue/AttendeeRunOfShow.tsx"]) {
  for (const leak of ["technicalCues", "producerNotes", "backupPlan", "emergencyNotes", "liveNotes"]) {
    if (read(guestFile).includes(leak)) fail(`${guestFile} must not read ${leak}`);
  }
}
if (/attendee-safe/i.test(read("app/venue/[eventId]/run-of-show/page.tsx"))) fail("Attendee run of show must not say attendee-safe");
if (!fs.existsSync("app/venue/[eventId]/run-of-show/page.tsx")) fail("Venue Run of Show route must exist");
for (const file of ["tests/e2e/role-gates.spec.ts", "tests/e2e/registration-profile.spec.ts", "tests/e2e/people-profile.spec.ts"]) {
  if (!fs.existsSync(file)) fail("missing browser coverage " + file);
}

console.log("validate_global_logo_and_stage_features: PASS");
