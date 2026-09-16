const fs = require("fs");
/**
 * Our own fixtures must never be presented to the owner as her network. On 16 Sep 2026 /app/people
 * showed 40 people, 34 of them Playwright and Tier-4 rows. The page, the count, the CSV export and
 * the Owner Console's people fold default to REAL people; the fixtures live behind a remembered
 * "Show test rows" toggle and can be archived (never hard-deleted). Classification is computed from
 * the email domain and the event, never from a hard-coded list of names.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
const classifier = check("services/attendees/testRowClassifier.ts", ["export function isTestEmail", "export function isTestEvent", "export function contactIsTestRow", "export function hashOnlyIsTestRow", "example.invalid", "playwright-", "tier4-"]);
const classifierCode = classifier.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const name of ["Tier 4 Browser Event Goer", "Outcome Attendee", "Duplicate E2E", "Throwaway Attendee"]) {
  if (classifierCode.includes(name)) throw new Error(`testRowClassifier hard-codes the fixture name "${name}"; classify by domain and event instead.`);
}
const directory = check("services/attendees/peopleDirectoryService.ts", ["export async function peopleDirectory", "export async function archiveTestPeople", "realCount", "testCount", 'status: "revoked"', "archivedAt: now"]);
if (/deleteContact|\.delete\(/.test(directory)) throw new Error("Test rows are archived, never deleted.");
const page = check("components/people/ContactsAcrossEvents.tsx", ["peopleDirectory()", "directory.realCount", "PeopleTestRowsToggle", "ArchiveTestRowsButton", "directory.real.contacts", "directory.test.contacts"]);
if (page.includes("eyebrow={`${directory.testCount}")) throw new Error("The headline count must be real people.");
if (!/eyebrow=\{`\$\{directory\.realCount\}/.test(page)) throw new Error("The headline count must be directory.realCount.");
check("components/people/PeopleTestRowsToggle.tsx", ["wpl-people-show-test-rows", "people-test-rows-toggle", "Show test rows"]);
check("components/people/ArchiveTestRowsButton.tsx", ["archiveTestPeopleAction", "window.confirm", "archived, never deleted"]);
check("lib/actions/peopleActions.ts", ['actor?.kind !== "owner"', "archiveTestPeople("]);
check("app/api/contacts/export/route.ts", ["peopleDirectory()", "includeTest"]);
check("components/owner/OwnerConsole.tsx", ["ContactsAcrossEvents({ compact: true })"]);
check("db/migrations/0030_contact_archive.sql", ["add column if not exists archived_at", "contacts"]);
check("tests/unit/peopleTestRows.test.ts", ["classifies by domain and by event, never by name", "the default view is the three real people", "leaves the three real people and their attendee rows untouched"]);
check("tests/e2e/people-test-rows.spec.ts", ["Show test rows", "example.invalid"]);
if (examined < 10) throw new Error(`validate_people_real_rows_first examined only ${examined} files`);
console.log(`validate_people_real_rows_first: PASS — ${examined} files examined; the split and the archive are proven by tests/unit/peopleTestRows.test.ts and tests/e2e/people-test-rows.spec.ts.`);
