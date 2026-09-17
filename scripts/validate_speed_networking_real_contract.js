const fs = require("fs");
/**
 * Real speed networking (16 Sep 2026). Static contract: the 0027 migration and its Supabase mirror
 * are byte-identical and probed by the health endpoint; both runtime stores implement the queue and
 * match rows; the matcher runs on every read through the existing pure engine with the match
 * history (no repeats); a networking room token goes only to the two matched attendees; the
 * networking page, the crew card, and the proofs exist.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
const canonical = "db/migrations/0027_speed_networking.sql";
const mirror = "supabase/migrations/20260916140000_speed_networking.sql";
if (read(canonical) !== read(mirror)) throw new Error(`${mirror} must be byte-identical to ${canonical}`);
examined += 2;
// The live project carries legacy speed_networking_* tables (0010: uuid ids, foreign keys). A new table
// must never reuse those names: "create table if not exists" would silently keep the old shape.
for (const legacy of ["speed_networking_entries", "speed_networking_matches", "speed_networking_queues", "speed_networking_reports", "speed_networking_skips"]) {
  for (const file of [canonical, "services/runtime/supabaseRuntimeStore.ts", "scripts/validate_supabase_schema_parity.js", "services/events/eventRepository.ts"]) {
    if (read(file).includes(legacy)) throw new Error(`${file} must not touch the legacy table ${legacy}; the runtime queue lives in networking_queue_*.`);
  }
}
check(canonical, ["create table if not exists public.networking_queue_entries", "create table if not exists public.networking_queue_matches", "unique (event_id, attendee_id)", "normalized_pair_key"]);
check("types/runtimeEvent.ts", ['SPEED_NETWORKING_MIGRATION_FILE = "db/migrations/0027_speed_networking.sql"', "networking_queue_entries: SPEED_NETWORKING_MIGRATION_FILE", "networking_queue_matches: SPEED_NETWORKING_MIGRATION_FILE"]);
check("services/events/eventRepository.ts", ['["networking_queue_entries", () => store.listSpeedNetworkingEntries("__schema_probe__")]', '["networking_queue_matches", () => store.listSpeedNetworkingMatches("__schema_probe__")]']);
check("scripts/validate_supabase_schema_parity.js", ["networking_queue_entries:", "networking_queue_matches:"]);
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) check(store, ["upsertSpeedNetworkingEntry", "getSpeedNetworkingEntry", "listSpeedNetworkingEntries", "upsertSpeedNetworkingMatch", "getSpeedNetworkingMatch", "listSpeedNetworkingMatches"]);
check("services/runtime/runtimeStore.ts", ["speedNetworkingEntries: SpeedNetworkingQueueEntry[]", "speedNetworkingMatches: SpeedNetworkingMatchRecord[]"]);
check("services/speed-networking/speedNetworkingService.ts", ["planSpeedNetworkingRound({ eventId, waiting: candidates", "export async function runNetworkingMatcher", 'await endMatch(eventId, match.id, "expired")', "speedNetworkingRoomName(eventId, matchId)", "settings.matchMinutes * 60_000", "export function tokenAllowedForRoom", "match.attendeeAId === attendeeId || match.attendeeBId === attendeeId", "export async function getMyNetworkingState"]);
check("types/speedNetworking.ts", ["SPEED_NETWORKING_DEFAULT_MINUTES = 4", "-net-"]);
// The grant moved ahead of the role branches (16 Sep 2026) so no non-attendee role can name a 1:1
// room; tokenAllowedForRoom is still the rule, now called through the room guard.
check("app/api/video/livekit-token/route.ts", ['body.roomType === "speed_networking"', "prepareSpeedNetworkingRoomForJoin", "status: 403"]);
check("services/speed-networking/speedNetworkingRoomGuard.ts", ["tokenAllowedForRoom(input.match, input.roomName, input.attendeeId)"]);
check("app/api/networking/mine/route.ts", ["getCurrentAttendeeIdentity(eventId)", "getMyNetworkingState(eventId, identity?.attendeeId)"]);
if (read("app/api/networking/mine/route.ts").includes('searchParams.get("attendeeId")')) throw new Error("/api/networking/mine must read only the caller's own state.");
check("lib/actions/networkingActions.ts", ["joinNetworkingQueue(eventId, {", "export async function nextSpeedNetworkingMatchAction", "export async function leaveSpeedNetworkingQueueAction", 'requireLiveEventControlAccessForRequest(eventId, "manage_stage_access")', "setNetworkingSettings("]);
// An unregistered viewer still reaches registration from networking, but through the one shared
// moment-of-intent ask (Join queue opens it) rather than a second Register card beside the page's
// one register invitation. validate_one_register_prompt owns that rule.
check("components/venue/SpeedNetworkingLive.tsx", ["Looking for your match…", 'roomType: "speed_networking"', "<LiveKitRoom", "connect audio video", "<ControlBar", "networking-partner-name", "networking-timer", "Next match", "End networking", "The crew has closed networking for now", "networking-registration-required", 'need="networking"']);
check("components/venue/SpeedNetworkingQueuePanel.tsx", ["joinSpeedNetworkingQueueAction", 'type="submit"', "<SpeedNetworkingLive"]);
check("components/moderation/NetworkingCrewCard.tsx", ["crewNetworkingSummary(eventId)", "networking-toggle-open", "networking-minutes-input", 'action="manage_stage_access"']);
check("components/moderation/CrewLiveModerationDeck.tsx", ["=> NetworkingCrewCard({ eventId"]);
check("lib/actions/registrationActions.ts", ["await ensureRuntimeEvent(eventId);\n  const event = getEventConfig(eventId);"]);
check("tests/unit/speedNetworkingReal.test.ts", ["a pair never meets twice", "a room token goes only to the two matched attendees of that active match", "closed networking stops pairing"]);
check("tests/e2e/speed-networking-real.spec.ts", ["matched within 10s", 'toMatch(/only to the two matched attendees/)', "networking-toggle-open"]);
if (examined < 20) throw new Error(`validate_speed_networking_real_contract examined only ${examined} files`);
console.log(`validate_speed_networking_real_contract: PASS — ${examined} files examined; the applied 0027 schema is read from /api/runtime/health after deploy.`);
