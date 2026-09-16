const fs = require("fs");

/**
 * Registration has to answer the owner's question (17 Sep 2026, from her own show on a phone): "what
 * if i registered already and was out, do i have to register again when i come back, how long does
 * my registration last if i exit? both on mobile and desktop?"
 *
 * Three things must stay true, and each of them has been quietly false before:
 *   1. the lifetime is a named, per-event value, and no sentence hard-codes it;
 *   2. a second device gets in on the email alone, rate-limited, never saying who is registered;
 *   3. NOTHING PRIVILEGED crosses an unverified email — the restored session is stamped, and every
 *      privileged read checks the stamp. A guard that nothing calls is the defect this repo keeps
 *      producing, so the call sites are asserted one by one, not just the guard's existence.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

// 1 · The lifetime is named, defaulted, clamped, and per-event.
const policy = check("services/attendees/attendeeSessionPolicy.ts", [
  "export const DEFAULT_ATTENDEE_SESSION_DAYS = 14",
  "export const RETURN_HINT_DAYS",
  "export const EXPIRING_SOON_HOURS",
  "export function clampSessionDays",
  "export async function attendeeSessionDaysFor",
  "export function registeredForWords",
  "event?.attendeeSessionDays",
]);
if (!/\$\{dayWord\(days\)\}/.test(policy)) throw new Error("Copy must read the resolved lifetime, never a typed number.");

const session = check("services/attendees/attendeeSessionService.ts", [
  "attendeeSessionDaysFor(profile.eventId)",
  "sessionMaxAgeSeconds(days)",
  "export async function getAttendeeSessionStanding",
  "export async function currentAttendeeMayHoldPrivilege",
  'assurance: options?.assurance || "device_registered"',
]);
if (/SESSION_DAYS\s*=\s*\d/.test(session)) throw new Error("The session lifetime is a magic number again in attendeeSessionService.ts.");
if (!/maxAge: sessionMaxAgeSeconds\(days\)/.test(session)) throw new Error("The cookie must outlive the session, or an expired return meets a blank form.");

// The per-event value must actually reach the database, not stop at the type.
check("types/runtimeEvent.ts", ["attendeeSessionDays?: number"]);
check("services/runtime/supabaseRuntimeStore.ts", ["attendee_session_days: event.attendeeSessionDays ?? null", "attendeeSessionDays: row.attendee_session_days"]);
check("services/events/eventRepository.ts", ['"attendeeSessionDays"']);
for (const migration of ["db/migrations/0039_attendee_session_lifetime.sql", "supabase/migrations/20260917070000_attendee_session_lifetime.sql"]) {
  check(migration, ["alter table public.runtime_events add column if not exists attendee_session_days integer;"]);
}
if (read("db/migrations/0039_attendee_session_lifetime.sql") !== read("supabase/migrations/20260917070000_attendee_session_lifetime.sql")) {
  throw new Error("Migration 0039 and its Supabase mirror must be byte-identical.");
}

// 2 · The second device: one field, rate-limited, and silent about who is registered.
const restore = check("services/attendees/attendeeReturnService.ts", [
  "export async function restoreAttendeeOnThisDevice",
  'gate: "attendee_return"',
  "checkGateAttempts(attemptKey)",
  "recordGateFailure(attemptKey)",
  "getAttendeeProfileByEmailHash(input.eventId, emailHash)",
  "upsertContactFromProfile(profile)",
  'createAttendeeSession(profile, { assurance: "email_restored" })',
]);
if (/not registered|no such (attendee|email)|never registered/i.test(restore)) throw new Error("The return path must never say whether an address is registered.");
// The counter must run before the lookup's outcome is known, or a hit is a free oracle.
if (restore.indexOf("recordGateFailure(attemptKey)") > restore.indexOf("getAttendeeProfileByEmailHash")) {
  throw new Error("Every attempt must be counted before the match is known, hit or miss.");
}
const action = check("lib/actions/attendeeReturnActions.ts", ["restoreRegistrationOnThisDeviceAction", "requestIpHash", "ensureRuntimeEvent(eventId)", "?email=${encodeURIComponent(email)}", "?wait=${outcome.retryInSeconds}", "registration_restored_on_new_device"]);
if (/email: email|attendeeEmail|metadata: \{[^}]*email[^}]*\}/.test(action.split("recordAnalyticsEvent")[1] || "")) throw new Error("Analytics for a return must not carry the address.");

// 3 · The guard is called. Each privileged surface, named.
check("app/venue/[eventId]/lobby/page.tsx", ["currentAttendeeMayHoldPrivilege", "attendee && mayHoldPrivilege ? await vipStandingFor("]);
check("app/api/attendee-live/mine/route.ts", ["currentAttendeeMayHoldPrivilege", "identity && mayHoldPrivilege ? await getAttendeeLiveCapability("]);
const token = check("app/api/video/livekit-token/route.ts", ["currentAttendeeMayHoldPrivilege", "mayHoldPrivilege", "canAttendeePublishLive("]);
if (!/mayHoldPrivilege\s*\n?\s*\?\s*await canAttendeePublishLive/.test(token)) throw new Error("A restored session must never be handed a publishing grant.");
if (!/canPublishAudio: false, canPublishVideo: false, canShareScreen: false/.test(token)) throw new Error("The refused branch must be watch-only, not a silent pass-through.");

// The copy the guest actually reads, and the way back out of an expired session.
check("components/venue/RegistrationContinuityNote.tsx", ["getAttendeeSessionStanding", "registeredForWords(standing.days)", "SECOND_DEVICE_WORDS", "ReturningAttendeeForm", 'data-continuity-state']);
check("components/venue/ReturningAttendeeForm.tsx", ["restoreRegistrationOnThisDeviceAction", "returning-attendee-email", "Bring my registration back"]);
check("components/venue/VenueLobbyDashboard.tsx", ["RegistrationContinuityNote", "justReturned"]);
check("components/venue/PublicEventPage.tsx", ["ReturningAttendeeForm", "registeredForWords(sessionDays)", "prefillEmail", "registration-lifetime-note"]);
check("app/events/[slug]/register/page.tsx", ["prefillEmail", "waitSeconds"]);
check("types/attendeeSession.ts", ["AttendeeSessionAssurance", '"email_restored"']);
check("tests/unit/registrationContinuity.test.ts", ["no privileged state crosses an unverified email", "cannot be used to enumerate who registered", "matched and healed", "an expired session gets the way back"]);

// No em-dashes in anything the guest reads: the owner's voice, and the one style rule she notices.
for (const file of ["components/venue/RegistrationContinuityNote.tsx", "components/venue/ReturningAttendeeForm.tsx", "services/attendees/attendeeSessionPolicy.ts"]) {
  const copy = read(file).split("\n").filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("/*") && !line.trim().startsWith("//"));
  if (copy.some((line) => line.includes("—"))) throw new Error(`${file} has an em-dash in guest-facing copy.`);
}

if (examined < 16) throw new Error(`validate_registration_continuity examined only ${examined} files; it must not pass on an empty loop.`);
console.log(`validate_registration_continuity: PASS — ${examined} files examined; the lifetime is named and per-event, the second device needs only an email, and no privileged state crosses an unverified one.`);
