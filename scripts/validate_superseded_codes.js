const fs = require("fs");
/**
 * An old code must never again be answered with "That code did not match an event".
 *
 * On 16 Sep 2026 somebody pressed "Adopt the readable codes" on the 45 minute AI workshop and its
 * event code went from WPL-GE43TU to WPL-45MINU. The confirm had warned that links already handed
 * out would stop working, and they did — but the person following the link Scooter had already sent
 * got the sentence a typo gets, with no way to tell that the event existed or that the code had
 * moved. Nothing in the system remembered a previous code at all.
 *
 * What this asserts, and why each piece is here rather than in a test:
 *
 *   1. The table exists, is mirrored, and is registered in RUNTIME_TABLE_MIGRATIONS — an unmirrored
 *      or unprobed migration never reaches production and looks exactly like working software.
 *   2. The window is a NAMED constant, not a magic number, and nothing hardcodes 90 elsewhere.
 *   3. THE FUNNEL. Every write of joinCode or accessCodes on a runtime event goes through a
 *      function that records the old value first. This is the one rule a unit test cannot hold:
 *      a NEW code-changing path added next month would pass every existing test while silently
 *      recreating the original bug. "Revoke host link" was exactly that path and was found by this
 *      check, not by a test.
 *   4. The attendee half resolves and the privileged half refuses — two opposite behaviours that a
 *      careless refactor could collapse into one.
 *   5. The confirms name a real count, and admit it where no count exists.
 *
 * Hard-fails when it examines zero files, so it can never pass on an empty loop.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) {
  const body = read(file);
  examined += 1;
  const missing = tokens.filter((token) => !body.includes(token));
  if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`);
  return body;
}

// --- 1. The table reaches production and is probed --------------------------------------------
const CANONICAL = "db/migrations/0046_superseded_access_codes.sql";
const MIRROR = "supabase/migrations/20260917140000_superseded_access_codes.sql";
const migration = check(CANONICAL, ["create table if not exists public.event_code_history", "code_key", "replaced_at", "reason", "event_code_history_code_key_idx"]);
const mirror = read(MIRROR);
examined += 1;
if (mirror !== migration) throw new Error(`${MIRROR} is not byte-identical to ${CANONICAL}; the Supabase integration applies the mirror, so they must not drift.`);

// The one real event this was found on. Backfilled, or the link already in the wild stays dead.
for (const token of ["45-minute-ai-workshop", "wpl-ge43tu", "WPLGE43TU"]) {
  if (!migration.includes(token)) throw new Error(`${CANONICAL} must backfill the superseded code for the owner's own event (missing ${token}); without it the link Scooter already sent never starts working again.`);
}
if (!migration.includes("not exists")) throw new Error(`${CANONICAL} backfill must be idempotent; a migration that duplicates its row on re-run is not safe to re-apply.`);

const map = check("types/runtimeEvent.ts", ["SUPERSEDED_CODES_MIGRATION_FILE", "event_code_history: SUPERSEDED_CODES_MIGRATION_FILE"]);
if (!map.includes(`"${CANONICAL}"`)) throw new Error(`RUNTIME_TABLE_MIGRATIONS must point event_code_history at ${CANONICAL}`);

// --- 2. The window is named, not a magic number ------------------------------------------------
const types = check("types/supersededCode.ts", ["export const SUPERSEDED_CODE_WINDOW_DAYS = 90", "export function supersededCodeIsLive", "export function supersededPrivilegedMessage", "export function supersededAttendeeMessage", "Ask the producer for the current one."]);
if (/\b90\b/.test(types.replace(/SUPERSEDED_CODE_WINDOW_DAYS = 90/, "").replace(/\/\*[\s\S]*?\*\//g, ""))) {
  throw new Error("types/supersededCode.ts repeats 90 outside the named constant; the window must have exactly one definition.");
}
for (const file of ["services/events/supersededCodeService.ts", "services/access/eventAccessResolver.ts", "services/events/eventStateResolver.ts"]) {
  const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  examined += 1;
  if (/\b90\b/.test(body)) throw new Error(`${file} hardcodes 90; import SUPERSEDED_CODE_WINDOW_DAYS instead.`);
}

// --- 3. THE FUNNEL: no code changes without recording the old value ----------------------------
/**
 * Every assignment that overwrites a runtime event's joinCode or a role code, outside the two
 * functions that record first. Creation is exempt: a brand-new event has no previous code.
 */
const CODE_WRITERS = [
  { file: "services/events/accessCodeService.ts", fn: "setEventAccessCode", records: "recordSupersededCode({ eventId, field, previousCode: current" },
  { file: "services/events/hostLinkService.ts", fn: "revokeHostLinks", records: 'recordSupersededCode({ eventId, field: "crew", previousCode: event.accessCodes.crew' },
];
for (const writer of CODE_WRITERS) {
  const body = check(writer.file, [writer.records]);
  const recordAt = body.indexOf(writer.records);
  // The record must be written BEFORE the row is upserted, or a failed write loses the old value.
  const upsertAt = body.indexOf("upsertRuntimeEvent", recordAt);
  if (upsertAt < 0) throw new Error(`${writer.file}: expected ${writer.fn} to upsert after recording`);
}

const ALLOWED_CODE_WRITERS = new Set(["services/events/accessCodeService.ts", "services/events/hostLinkService.ts", "services/events/eventRepository.ts", "services/runtime/supabaseRuntimeStore.ts"]);
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}
const sourceFiles = [...walk("services"), ...walk("lib"), ...walk("app"), ...walk("components")];
if (!sourceFiles.length) throw new Error("validate_superseded_codes found no source files to scan; the funnel check would have passed vacuously.");
let scanned = 0;
for (const file of sourceFiles) {
  if (ALLOWED_CODE_WRITERS.has(file)) continue;
  const body = fs.readFileSync(file, "utf8");
  scanned += 1;
  // `joinCode: <expr>,` or `accessCodes: { ... }` inside an object spread over an existing event.
  if (/\.{3}\s*event\s*,[\s\S]{0,200}?\b(joinCode|accessCodes)\s*:/.test(body)) {
    throw new Error(`${file} overwrites an event's codes outside the recorded funnel. Route it through setEventAccessCode (or revokeHostLinks for the crew code) so the old value is remembered, or the old link goes back to "that code did not match an event".`);
  }
}
if (scanned < 100) throw new Error(`the funnel scan examined only ${scanned} files; it is not reaching the app.`);
examined += 1;

// --- 4. Two opposite behaviours: attendee resolves, privileged refuses --------------------------
const resolver = check("services/events/eventStateResolver.ts", ["findSupersededCode", 'superseded.record.field !== "join"', "supersededCode: displayCode(superseded.record.code)"]);
if (!/direct\.reason !== "invalid_code"/.test(resolver)) throw new Error("services/events/eventStateResolver.ts must consult the history only after a genuine miss; a current code has to win.");

const gate = check("services/access/eventAccessResolver.ts", ["findSupersededCodeForField", "supersededPrivilegedMessage", 'reason: "superseded_code"', "ROLE_FIELD"]);
// The refusal must stay a refusal. Every superseded branch returns ok:false and no destination.
for (const match of gate.match(/reason: "superseded_code"[^}]*}/g) || []) {
  if (!/ok: false/.test(gate.slice(Math.max(0, gate.indexOf(match) - 120), gate.indexOf(match)))) {
    throw new Error("a superseded privileged code must refuse: every superseded_code branch returns ok:false.");
  }
  if (/destination/.test(match)) throw new Error("a superseded privileged code must never carry a destination.");
}
if (!gate.includes('crew_lite: "crew"')) throw new Error("crew_lite shares the crew code and must be looked up against the crew field.");

// The attendee is not made to re-enter anything: /join redirects, it does not re-prompt.
check("app/join/page.tsx", ["withSupersededCode(resolution.destination, resolution.supersededCode)", "SupersededCodeNotice"]);
check("components/access/SupersededCodeNotice.tsx", ["supersededAttendeeMessage", "superseded-code-notice", "export function withSupersededCode"]);
check("components/access/SupersededGateNotice.tsx", ["supersededPrivilegedMessage", "export function supersededGateQuery"]);
for (const page of ["app/production-access/crew/page.tsx", "app/production-access/special-guest/page.tsx", "app/api/production-access/crew/route.ts", "app/api/production-access/special-guest/route.ts"]) {
  check(page, ["supersededGateQuery"]);
}
// The notice reaches all three places /join can land, or an old link lands silently.
for (const destination of ["app/venue/[eventId]/stage/page.tsx", "app/venue/[eventId]/replay/page.tsx", "app/events/[slug]/page.tsx"]) {
  check(destination, ["SupersededCodeNotice", "codeChanged"]);
}

// --- 5. The confirms name a real count ----------------------------------------------------------
const service = check("services/events/supersededCodeService.ts", ["export async function describeCodeChangeImpact", "registered attendee", "We do not record how many role links were copied out"]);
if (!service.includes("in the venue right now")) throw new Error("the impact must name the live audience; that is the number that matters mid-show.");
const vault = check("components/owner/AccessCodesVaultTable.tsx", ["event.adoptImpact", "${code.impact}", "impact: string;"]);
if (/Links already handed out with the old codes stop working\./.test(vault)) {
  throw new Error("the Adopt confirm still says only that links stop working; it must name how many.");
}
if (/Every link and every session already handed out with the old code stops working immediately\./.test(vault)) {
  throw new Error("the Rotate confirm still says only that links stop working; it must name how many.");
}
check("components/owner/AccessCodesVault.tsx", ["describeCodeChangeImpact", "adoptImpact"]);
check("components/events/EventAccessCodesPanel.tsx", ["describeCodeChangeImpact", "liveSupersededCodesFor", "SUPERSEDED_CODE_WINDOW_DAYS"]);

// --- The store carries it end to end -----------------------------------------------------------
check("services/runtime/runtimeStore.ts", ["appendSupersededCode", "findSupersededCode", "listSupersededCodes", "eventCodeHistory"]);
check("services/runtime/fileRuntimeStore.ts", ["appendSupersededCode", "eventCodeHistory"]);
check("services/runtime/supabaseRuntimeStore.ts", ['from("event_code_history")', "supersededCodeFromRow"]);

// --- The behaviour is proven, not only shaped ---------------------------------------------------
check("tests/unit/supersededCodes.test.ts", [
  "a superseded attendee code resolves to the event and carries the changed-code notice",
  "a superseded crew code is refused with the informative message and grants nothing",
  "an unknown code still gets the ordinary not-found",
  "the window expires",
  "the confirm text carries a real count",
]);

if (examined < 22) throw new Error(`validate_superseded_codes examined only ${examined} files`);
console.log(`validate_superseded_codes: PASS — ${examined} files examined, ${scanned} scanned for stray code writes; 0046 mirrored, probed and backfilled with WPL-GE43TU, the ${SUPERSEDED_CODE_WINDOW_DAYS_LABEL()}-day window named once, every code change funnelled through a recorded path, attendees landed and privileged codes refused informatively, confirms carrying real counts.`);

function SUPERSEDED_CODE_WINDOW_DAYS_LABEL() {
  return (/SUPERSEDED_CODE_WINDOW_DAYS = (\d+)/.exec(types) || [, "?"])[1];
}
