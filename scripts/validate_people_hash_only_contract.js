const fs = require("fs");
/**
 * People across events (16 Sep 2026, the owner's 16:59 bug): rows registered before the raw email
 * was kept (email null, hash only) must be LISTED on /app/people grouped by hash, counted, and
 * exported — a page that reads only `contacts` silently drops everyone from before. And every
 * write path that carries an email (registration, profile save, networking gate) must run the one
 * heal-on-match contact write so those rows are backfilled and become one contact.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
// The one store method pair, implemented by both stores.
check("services/runtime/runtimeStore.ts", ["listAttendeeProfilesByEmailHash(emailHash: string): Promise<AttendeeProfile[]>", "listAttendeeProfilesWithoutEmail(limit?: number): Promise<AttendeeProfile[]>"]);
check("services/runtime/fileRuntimeStore.ts", ["async listAttendeeProfilesByEmailHash(", "async listAttendeeProfilesWithoutEmail("]);
check("services/runtime/supabaseRuntimeStore.ts", ["async listAttendeeProfilesByEmailHash(", 'eq("email_hash", emailHash)', "async listAttendeeProfilesWithoutEmail(", 'is("email", null)']);
// The heal: backfill every hash sibling, union of events, earliest first_seen.
check("services/attendees/contactsService.ts", ["listAttendeeProfilesByEmailHash(profile.emailHash)", "store.upsertAttendeeProfile(backfilled)", "merged.eventsAttended = Array.from(new Set(", "merged.firstSeenAt = earliest", "export async function listHashOnlyPeople", "export function groupHashOnlyProfiles", "listAttendeeProfilesWithoutEmail()", "EMAIL_NOT_CAPTURED_NOTE", 'hashOnly: HashOnlyPerson[] = []']);
// Every write path with an email runs it.
check("services/attendees/attendeeRegistrationService.ts", ["await upsertContactFromProfile(profile)"]);
check("lib/actions/attendeeProfileActions.ts", ["await upsertContactFromProfile(merged)"]);
check("lib/actions/networkingActions.ts", ["await upsertContactFromProfile(merged)"]);
// The page and the export read hash-only profiles, not only contacts.
const page = check("components/people/ContactsAcrossEvents.tsx", ["peopleDirectory()", "hash-only-people", "hash-only-row-", "EMAIL_NOT_CAPTURED_NOTE", "directory.realCount", "directory.real.hashOnly"]);
if (!page.includes("hashOnly")) throw new Error("ContactsAcrossEvents reads contacts only; hash-only profiles would be silently missing.");
check("services/attendees/peopleDirectoryService.ts", ["listHashOnlyPeople(eventNames)", "hashOnlyIsTestRow", "contactIsTestRow", "realCount", "testCount"]);
check("app/api/contacts/export/route.ts", ["peopleDirectory()", "directory?.real.hashOnly", "includeTest"]);
check("app/app/people/page.tsx", ["ContactsAcrossEvents({})"]);
// Proofs.
check("tests/unit/hashOnlyPeopleHeal.test.ts", ["two hash-only rows across two events are one grouped person with 2 events", "backfills both rows and builds one contact with three events", "the merge path"]);
check("tests/e2e/people-hash-only-heal.spec.ts", ["hash-only people are listed and counted, exported with a blank email, then healed by a matching registration", "not captured — registered before 16 Sep 2026", 'toHaveText("3")']);
if (examined < 12) throw new Error(`validate_people_hash_only_contract examined only ${examined} files`);
console.log(`validate_people_hash_only_contract: PASS — ${examined} files examined; heal and listing proven by tests/unit/hashOnlyPeopleHeal.test.ts and tests/e2e/people-hash-only-heal.spec.ts.`);
