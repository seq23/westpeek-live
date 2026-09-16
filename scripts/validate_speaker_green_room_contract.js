#!/usr/bin/env node
// Real special-guest flow contract (speaker green room, cue cards, sponsor / VIP / client).
// Proves, statically, that: the 0026 migration and its mirror are byte-identical and probed by the
// health endpoint; both stores implement guest identity and guest state; identity comes from the
// role code (no speaker-drake on any speaker route); LiveKit grants are decided by one pure rule the
// token route uses (speaker: green room always, stage only when brought up; attendee: never the
// green room); every crew action is guarded and the end-of-grant drops the participant; the speaker
// only reads their own deck through the polling route; the surfaces exist; and the proofs exist.
// Hard-fails on zero examined items.
const fs = require("fs");
const path = require("path");

const failures = [];
let examined = 0;
function read(file) {
  if (!fs.existsSync(file)) { failures.push(`missing ${file}`); return ""; }
  examined += 1;
  return fs.readFileSync(file, "utf8");
}
function requireTokens(file, tokens) {
  const text = read(file);
  for (const token of tokens) if (!text.includes(token)) failures.push(`${file} missing required token: ${token}`);
}
function forbidTokens(file, tokens) {
  const text = read(file);
  for (const token of tokens) if (text.includes(token)) failures.push(`${file} still contains forbidden token: ${token}`);
}

// 1. Migration + mirror + probe.
const canonical = "db/migrations/0026_special_guest_identity_and_state.sql";
const canonicalSql = read(canonical);
const mirrors = fs.existsSync("supabase/migrations") ? fs.readdirSync("supabase/migrations").filter((name) => name.endsWith("_special_guest_identity_and_state.sql")) : [];
if (mirrors.length !== 1) failures.push(`supabase/migrations must contain exactly one *_special_guest_identity_and_state.sql mirror (found ${mirrors.length})`);
for (const name of mirrors) if (read(path.join("supabase/migrations", name)) !== canonicalSql) failures.push(`supabase/migrations/${name} drifted from ${canonical}`);
for (const token of ["create table if not exists public.special_guest_profiles", "create table if not exists public.event_guest_states", "check (role in ('speaker', 'sponsor', 'vip', 'client'))"]) if (!canonicalSql.includes(token)) failures.push(`${canonical} missing: ${token}`);
requireTokens("services/events/eventRepository.ts", ['["special_guest_profiles"', '["event_guest_states"']);
requireTokens("scripts/validate_supabase_schema_parity.js", ["special_guest_profiles", "event_guest_states"]);

// 2. Both stores.
const storeMethods = ["upsertSpecialGuestProfile", "getSpecialGuestProfile", "listSpecialGuestProfiles", "setEventGuestState", "getEventGuestState", "listEventGuestStates"];
for (const file of ["services/runtime/runtimeStore.ts", "services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) requireTokens(file, storeMethods);

// 3. Identity from the code; no mock speaker on the speaker routes.
requireTokens("services/guests/guestIdentityService.ts", ['GUEST_IDENTITY_COOKIE = "wpl_guest_identity"', "export async function registerGuestIdentity", "export async function getCurrentGuestIdentity", "export async function getCurrentSpecialGuestAccess"]);
for (const page of ["app/speaker/events/[eventId]/page.tsx", "app/speaker/events/[eventId]/green-room/page.tsx", "app/speaker/events/[eventId]/tech-check/page.tsx", "app/speaker/events/[eventId]/teleprompter/page.tsx", "app/speaker/events/[eventId]/backstage/page.tsx", "app/speaker/events/[eventId]/onboarding/page.tsx"]) {
  requireTokens(page, ["getCurrentGuestIdentity("]);
  forbidTokens(page, ["speaker-drake", "SpeakerPortalDashboard", "getSpeakerGreenRoomSnapshot", "mockSpeakerOpsService"]);
}
for (const component of ["components/speakers/SpeakerGreenRoomLive.tsx", "components/speakers/SpeakerTeleprompterLive.tsx", "components/speakers/SpeakerCuePastePanel.tsx", "components/speakers/SpeakerPortalHome.tsx", "components/moderation/SpeakerRosterPanel.tsx"]) forbidTokens(component, ["speaker-drake", "speaker-ops"]);

// 4. One pure grant rule, used by the token route; green room is a deterministic room name.
requireTokens("services/guests/guestVideoGrants.ts", ["export function decideGuestVideoGrant", 'if (input.roomType === "green_room")', 'input.role === "attendee"', 'if (status === "backstage") return { ok: false']);
requireTokens("app/api/video/livekit-token/route.ts", ["decideGuestVideoGrant(", 'getCurrentGuestIdentity(body.eventId, "speaker")', "getSpeakerStageState(", "providerFailure: true"]);
requireTokens("services/video/livekitRoomUiService.ts", ['input.roomType === "green_room" ? normalizeLiveKitRoomName(input.eventId, "green-room")']);

// 5. Crew actions guarded; send backstage drops the participant; speaker cannot self-grant.
const actions = read("lib/actions/speakerStageActions.ts");
for (const name of ["bringSpeakerToStageAction", "sendSpeakerBackstageAction", "saveProducerCueDeckAction", "approveSpeakerCueDeckAction", "pushLiveCueAction", "saveProducerNotesAction", "setVipRoomAction"]) {
  const start = actions.indexOf(`export async function ${name}(`);
  if (start < 0) { failures.push(`speakerStageActions.ts missing ${name}`); continue; }
  const body = actions.slice(start, actions.indexOf("\n}\n", start));
  // The guard now names the crew action it checks the role against (manage_stage_access / manage_cue_cards).
  if (!/await requireControl\(eventId, "(manage_stage_access|manage_cue_cards)"\)/.test(body)) failures.push(`${name} must call requireControl with its crew action before mutating`);
}
requireTokens("lib/actions/speakerStageActions.ts", ["removeLiveKitParticipantFromMainStage({ eventId, stageId: \"main-stage\", attendeeId: speakerId })"]);
requireTokens("services/guests/guestStateService.ts", ['if (current.status === "backstage") return current;', "export function submitCueDeckVersion", "export function approvePendingCueDeck", 'status: input.author === "producer" ? "approved" : "pending"']);
const guestActions = read("lib/actions/guestActions.ts");
for (const name of ["registerGuestIdentityAction", "recordSpeakerTechCheckAction", "goOnStageAction", "submitSpeakerCueDeckAction", "saveSponsorBoothAction"]) {
  const start = guestActions.indexOf(`export async function ${name}(`);
  if (start < 0) { failures.push(`guestActions.ts missing ${name}`); continue; }
  const body = guestActions.slice(start, guestActions.indexOf("\n}\n", start));
  if (!body.includes("await requireGuestRole(eventId,")) failures.push(`${name} must check the special-guest role before mutating`);
}
requireTokens("app/api/speaker/cue-deck/route.ts", ['getCurrentGuestIdentity(eventId, "speaker")', "requireLiveEventControlAccessForRequest", "status: 403"]);

// 6. Surfaces.
requireTokens("components/speakers/SpeakerGreenRoomLive.tsx", ["speaker-green-room", "go-on-stage", 'roomType="green_room"', "producer-notes-to-speakers", "speaker-run-of-show", "<SpeakerTeleprompterLive"]);
requireTokens("components/speakers/SpeakerTeleprompterLive.tsx", ["/api/speaker/cue-deck", "5_000", "deck-changed-banner", "live-cue-banner", "teleprompter-next", "teleprompter-prev"]);
requireTokens("components/speakers/SpeakerTechCheckLive.tsx", ["<BrowserDiagnosticsPanel", "recordSpeakerTechCheckAction", "record-tech-check"]);
requireTokens("components/moderation/SpeakerRosterPanel.tsx", ["bring-to-stage-", "send-backstage-", "save-cue-deck-", "approve-cue-deck-", "push-live-cue-", "producer-notes-form", "vip-room-toggle"]);
requireTokens("components/moderation/CrewLiveModerationDeck.tsx", ["<SpeakerRosterPanel eventId="]);
requireTokens("components/sponsors/SponsorPortalLive.tsx", ["sponsor-booth-editor", "saveSponsorBoothAction", "Sponsor portal", "Booth setup"]);
requireTokens("services/guests/runtimeBooths.ts", ["export async function withRuntimeBooths"]);
requireTokens("app/venue/[eventId]/expo/page.tsx", ["withRuntimeBooths("]);
requireTokens("components/venue/VipLobbyPanel.tsx", ["vip-badge", "vip-lounge", "getVipRoom("]);
// The VIP lounge is open by default for every runtime event (owner, 16 Sep 2026); a stored crew decision is respected.
requireTokens("services/guests/guestStateService.ts", ["export const VIP_ROOM_DEFAULT: VipRoomState = { open: true"]);
requireTokens("tests/unit/speakerGreenRoom.test.ts", ["is open for an event with no stored decision"]);
requireTokens("tests/e2e/speaker-green-room.spec.ts", ["Close the VIP lounge"]);
requireTokens("app/venue/[eventId]/lobby/page.tsx", ['guest?.role === "vip"']);
requireTokens("components/clients/ClientPortal.tsx", ['runtime.source !== "seed") return <ClientRuntimeOverview']);
requireTokens("components/speakers/SpeakerMaterialIntakePanel.tsx", ["listSpeakerCueDecks(", "speaker-pending-cue-decks"]);

// 7. Proof.
requireTokens("tests/unit/speakerGreenRoom.test.ts", ["a speaker gets the green room always, the stage only once brought up; attendees never get the green room", "producer saves are approved on save, speaker pastes are pending until approved", "a speaker only ever reads their own approved cards", "send backstage revokes and drops them from the stage room", "refused without a crew, operator, or owner cookie"]);
requireTokens("tests/e2e/speaker-green-room.spec.ts", ["record-tech-check", "save-cue-deck-", "approve-cue-deck-", "deck-changed-banner", "live-cue-banner", "bring-to-stage-", "go-on-stage", "send-backstage-", "speakers and crew only", "sponsor-booth-saved", "vip-lounge", "client-runtime-overview"]);

if (examined === 0) failures.push("validate_speaker_green_room_contract examined zero files");
if (failures.length) {
  console.error("validate_speaker_green_room_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_speaker_green_room_contract: PASS — ${examined} files examined; static contract only, the applied schema is read from /api/runtime/health after deploy.`);
