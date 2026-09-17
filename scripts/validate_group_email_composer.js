const fs = require("fs");
/**
 * One composer, and an unsubscribe that is not optional (17 Sep 2026).
 *
 * The owner could email seven named individuals one at a time and could not email a group at all —
 * not attendees, not VIPs, not crew. The composer at /app/email/compose sends to a resolved
 * audience, and the moment it does that it is bulk email. This validator holds the five things that
 * make that safe rather than reputation-destroying:
 *
 *   1. the audience is resolved from the real rows and an empty one is REFUSED, never reported sent;
 *   2. a person in two groups is emailed once;
 *   3. every group send carries a signed unsubscribe link and the List-Unsubscribe pair, and the
 *      suppression list is applied to group sends and NEVER to a transactional one;
 *   4. the daily allowance is checked before the first message, so nothing is half-sent;
 *   5. nothing sends without a person pressing a button — no timer, no cron, no queue.
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
/** Comments describe the rule; only the code can break it. Stripped before the "no timer" checks. */
function codeOnly(body) { return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); }

// 1 · the audience is real rows, deduped, and an empty group is refused ------------------------
const audience = check("services/email/emailAudienceService.ts", [
  "listAttendeeProfiles",        // attendees come from attendee_profiles
  "listVipStanding",             // VIPs come from real grants
  "listGuestProfiles",           // speakers / sponsors / clients
  "listSuppliersForEvent",       // crew comes from the event's contractors
  "listRuntimeClients",          // the client contact
  "suppressedAddresses",
  "export async function resolveAudience",
  "export function describeAudience",
]);
must(audience.includes("if (this.byKey.has(address)) return;"), "A person in two groups must be emailed once: the resolver must dedupe on the address.");
must(audience.includes("if (!members.length)") && audience.includes("Nothing will be sent") && /return \{ \.\.\.base, members: \[\][\s\S]{0,120}ok: false/.test(audience), "An empty audience must refuse, with a sentence saying nothing will be sent.");
must(audience.includes("noteUnreachable"), "Somebody with no address on file must be counted, not silently dropped.");
must(audience.includes('grant.current'), "A VIP grant made under a rotated code is not a current VIP and must not be mailed.");
must(audience.includes('input.kind === "one_person"'), "One person by name must be resolvable without an event.");
must(audience.indexOf('input.kind === "one_person"') < audience.indexOf("suppressedSet"), "The one-person case must return BEFORE the suppression list is read, so a message addressed to somebody by name is never suppressed.");

// 2 · the unsubscribe list, its token, and the strict transactional boundary --------------------
const suppression = check("services/email/emailSuppressionService.ts", [
  "hmacSha256Base64Url",
  "export async function buildUnsubscribeToken",
  "export async function readUnsubscribeToken",
  "export async function recordUnsubscribe",
  "export async function recordResubscribe",
  "export async function suppressedAddresses",
  "constantTimeEquals",
]);
must(suppression.includes("base64UrlEncode(address)"), "The address must be inside the token and covered by the signature, so a token cannot be replayed for somebody else.");
must(!/expiresAt|maxAge|ttl/i.test(suppression), "An unsubscribe link must not expire: the alternative for the recipient is the spam button.");

const group = check("services/email/groupEmailService.ts", [
  "List-Unsubscribe",
  "List-Unsubscribe-Post",
  "unsubscribeUrl",
  "checkSendAllowance",
  "appendEmailGroupSend",
  "appendEmailSendLog",
  "expectedCount",
  "groupSendId",
]);
must(group.includes('const isGroup = input.audience !== "one_person";'), "The group / transactional distinction must be explicit in code, not implied.");
must(group.includes("if (isGroup) {"), "The unsubscribe footer and the List-Unsubscribe headers must be added only to group sends.");
must(group.indexOf("const allowance = await checkSendAllowance(") < group.indexOf("for (const member of audience.members)"), "The daily allowance must be checked BEFORE the send loop, or a send can be half-delivered.");
must(/if \(!allowance\.ok\) return \{ ok: false, sent: 0/.test(group), "A send over the allowance must return having sent nothing at all.");
must(/if \(!audience\.ok\) return/.test(group), "A refused audience must stop the send before anything is built.");
must(!/setInterval|setTimeout|cron|scheduled|CronTrigger/i.test(codeOnly(group)), "Nothing may send on a timer.");

// The transactional sender must never learn about the suppression list.
const transactional = check("services/email/eventEmailService.ts", ["sendManualWorkflow"]);
must(!transactional.includes("emailSuppressionService") && !transactional.includes("suppressedAddresses"), "A transactional send to one named person must never consult the unsubscribe list: a speaker who unsubscribed from announcements still gets their green room link.");

// 3 · the volume, counted from something we can actually read ----------------------------------
const volume = check("services/email/emailVolumeService.ts", ["RESEND_DAILY_ALLOWANCE", "RESEND_MONTHLY_ALLOWANCE", "export async function checkSendAllowance", "VOLUME_SOURCE_NOTE"]);
must(volume.includes("Counted from this app's own send log"), "The usage figure must say what it is counting rather than implying it came from Resend.");
must(volume.includes('row.provider === "resend"'), "A mock row never left the building and must not count against a real allowance.");

// 4 · the surfaces -----------------------------------------------------------------------------
const composer = check("components/email/EmailComposer.tsx", [
  "composer-count",          // the resolved count, before the send
  "composer-expand",         // and exactly who, since a wrong audience is unrecoverable
  "composer-confirm",        // the confirm names the audience and the count
  "expectedCount",           // which then travels with the send
  "sendGroupEmailAction",
  "AUDIENCE_OPTIONS",
  "composer-refusal",
]);
must(composer.includes("resolveAudience"), "The composer must resolve the audience itself rather than trusting a number in the URL.");
check("app/app/email/compose/page.tsx", ["EmailComposer", "GroupEmailOverview", "UnsubscribeList"]);
check("components/email/GroupEmailOverview.tsx", ["emailVolume", "listGroupSends", "group-send-", "email-volume-note"]);
check("components/email/UnsubscribeList.tsx", ["listUnsubscribes", "setUnsubscribeAction", "unsubscribe-row-"]);
check("components/email/ComposeLink.tsx", ["/app/email/compose?", "compose-link-"]);

// The one-click page and endpoint must work with no login at all.
const page = check("app/unsubscribe/page.tsx", ["readUnsubscribeToken", "unsubscribe-done", "unsubscribe-undo", "unsubscribe-invalid"]);
must(!/getCrewViewer|requireLiveEventControlAccess|redirect\("\/login/.test(page), "The unsubscribe page must work without a login: the recipient of an announcement has no account.");
const route = check("app/api/email/unsubscribe/route.ts", ["export async function POST", "readUnsubscribeToken", "recordUnsubscribe"]);
must(route.includes("List-Unsubscribe=One-Click") || route.includes("One-Click"), "The one-click endpoint must answer the RFC 8058 POST that Gmail and Apple Mail send.");
const routeAccess = check("lib/auth/routeAccess.ts", ["protectedRouteRequirements"]);
must(!/"\/unsubscribe"|'\/unsubscribe'/.test(routeAccess), "/unsubscribe must not be a protected prefix.");

// The links from where the work happens — links only, no send from a list.
for (const [file, audienceKind] of [["components/speakers/SpeakerManager.tsx", "speakers"], ["components/sponsors/SponsorManager.tsx", "sponsors"], ["components/moderation/AttendeeLiveRoster.tsx", "attendees"]]) {
  check(file, [`<ComposeLink`, `audience="${audienceKind}"`]);
}
check("app/app/email/page.tsx", ["GroupEmailOverview"]);

// 5 · the write path is one server action behind a button --------------------------------------
const actions = check("lib/actions/groupEmailActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "manage_access_codes")', "sendGroupEmail(", "sentBy"]);
must(!/setInterval|setTimeout|cron|scheduled/i.test(codeOnly(actions)), "Nothing may send on a timer.");
must(actions.includes('viewer.kind !== "owner" && viewer.kind !== "operator"'), "A send with no event reaches people across every show and must take an owner or operator sign-in.");

// 6 · the migration, and the mirror that actually reaches production ---------------------------
const migration = check("db/migrations/0044_email_group_sends_and_unsubscribes.sql", [
  "create table if not exists public.runtime_email_unsubscribes",
  "create table if not exists public.runtime_email_group_sends",
  "alter table public.runtime_email_sends add column if not exists group_send_id text",
  "alter table public.special_guest_profiles add column if not exists email text",
  "resubscribed_at",
]);
must(migration.includes("email text primary key"), "The unsubscribe list is keyed by person, not by event: one row per address.");
const mirror = "supabase/migrations/20260917120000_email_group_sends_and_unsubscribes.sql";
must(fs.existsSync(mirror), `${mirror} is missing; the migration would never run in production.`);
if (fs.existsSync(mirror)) { examined += 1; must(read(mirror) === migration, "The 0044 mirror drifted from the canonical migration."); }

// A speaker had no address to email before today: the field and the form that fills it.
check("types/specialGuest.ts", ["email?: string"]);
check("components/guests/GuestIdentityForm.tsx", ['name="email"', "guest-email"]);
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) {
  check(store, ["appendEmailGroupSend", "listEmailGroupSends", "upsertEmailUnsubscribe", "listEmailUnsubscribes"]);
}
check("tests/unit/groupEmail.test.ts", [
  "each audience resolves to the people actually in it",
  "a person in two groups is emailed once",
  "an empty audience refuses",
  "does NOT suppress a transactional one",
  "cannot be guessed, tampered with, or replayed",
  "refuses before sending rather than half-sending",
]);

// Rule 0: this must never pass on an empty loop.
if (examined < 18) failures.push(`validate_group_email_composer examined only ${examined} files; the rule would pass on an empty loop.`);
if (failures.length) {
  console.error("validate_group_email_composer: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_group_email_composer: PASS — ${examined} files examined; audiences resolve from real rows and dedupe, an empty group is refused, every group send carries a signed unsubscribe and the List-Unsubscribe pair, transactional sends are never suppressed, the daily allowance refuses before the first message, and nothing sends without a person pressing a button.`);
