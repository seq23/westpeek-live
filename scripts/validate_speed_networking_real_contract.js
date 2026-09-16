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
check(canonical, ["create table if not exists public.speed_networking_entries", "create table if not exists public.speed_networking_matches", "unique (event_id, attendee_id)", "normalized_pair_key"]);
check("types/runtimeEvent.ts", ['SPEED_NETWORKING_MIGRATION_FILE = "db/migrations/0027_speed_networking.sql"', "speed_networking_entries: SPEED_NETWORKING_MIGRATION_FILE", "speed_networking_matches: SPEED_NETWORKING_MIGRATION_FILE"]);
check("services/events/eventRepository.ts", ['["speed_networking_entries", () => store.listSpeedNetworkingEntries("__schema_probe__")]', '["speed_networking_matches", () => store.listSpeedNetworkingMatches("__schema_probe__")]']);
check("scripts/validate_supabase_schema_parity.js", ["speed_networking_entries:", "speed_networking_matches:"]);
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) check(store, ["upsertSpeedNetworkingEntry", "getSpeedNetworkingEntry", "listSpeedNetworkingEntries", "upsertSpeedNetworkingMatch", "getSpeedNetworkingMatch", "listSpeedNetworkingMatches"]);
check("services/runtime/runtimeStore.ts", ["speedNetworkingEntries: SpeedNetworkingQueueEntry[]", "speedNetworkingMatches: SpeedNetworkingMatchRecord[]"]);
check("services/speed-networking/speedNetworkingService.ts", ["selectNextSpeedNetworkingPair(entries.map(toEngineEntry), [], history)", "export async function runNetworkingMatcher", 'await endMatch(eventId, match.id, "expired")', "speedNetworkingRoomName(eventId, matchId)", "settings.matchMinutes * 60_000", "export function tokenAllowedForRoom", "match.attendeeAId === attendeeId || match.attendeeBId === attendeeId", "export async function getMyNetworkingState"]);
check("types/speedNetworking.ts", ["SPEED_NETWORKING_DEFAULT_MINUTES = 4", "-net-"]);
check("app/api/video/livekit-token/route.ts", ['body.roomType === "speed_networking"', "tokenAllowedForRoom(match, body.roomId, identity.attendeeId)", "status: 403"]);
check("app/api/networking/mine/route.ts", ["getCurrentAttendeeIdentity(eventId)", "getMyNetworkingState(eventId, identity?.attendeeId)"]);
if (read("app/api/networking/mine/route.ts").includes('searchParams.get("attendeeId")')) throw new Error("/api/networking/mine must read only the caller's own state.");
check("lib/actions/networkingActions.ts", ["joinNetworkingQueue(eventId, {", "export async function nextSpeedNetworkingMatchAction", "export async function leaveSpeedNetworkingQueueAction", 'requireLiveEventControlAccessForRequest(eventId, "manage_stage_access")', "setNetworkingSettings("]);
check("components/venue/SpeedNetworkingLive.tsx", ["Looking for your match…", 'roomType: "speed_networking"', "<LiveKitRoom", "connect audio video", "<ControlBar", "networking-partner-name", "networking-timer", "Next match", "End networking", "The crew has closed networking for now", "networking-register-link"]);
check("components/venue/SpeedNetworkingQueuePanel.tsx", ["joinSpeedNetworkingQueueAction", 'type="submit"', "<SpeedNetworkingLive"]);
check("components/moderation/NetworkingCrewCard.tsx", ["crewNetworkingSummary(eventId)", "networking-toggle-open", "networking-minutes-input", 'action="manage_stage_access"']);
check("components/moderation/CrewLiveModerationDeck.tsx", ["<NetworkingCrewCard"]);
check("lib/actions/registrationActions.ts", ["await ensureRuntimeEvent(eventId);\n  const event = getEventConfig(eventId);"]);
check("tests/unit/speedNetworkingReal.test.ts", ["a pair never meets twice", "a room token goes only to the two matched attendees of that active match", "closed networking stops pairing"]);
check("tests/e2e/speed-networking-real.spec.ts", ["matched within 10s", 'toMatch(/only to the two matched attendees/)', "networking-toggle-open"]);
if (examined < 20) throw new Error(`validate_speed_networking_real_contract examined only ${examined} files`);
console.log(`validate_speed_networking_real_contract: PASS — ${examined} files examined; the applied 0027 schema is read from /api/runtime/health after deploy.`);
