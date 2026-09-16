#!/usr/bin/env node
// Crew chat moderation contract (hide / restore, silence / unsilence, lock / unlock, moderation queue).
// Proves, statically, that: the 0025 migration and its Supabase mirror are byte-identical; both runtime
// stores implement every moderation method; the attendee listing excludes hidden messages by default;
// silence and lock are enforced on the write path in the service (not only in the UI); every crew
// action is guarded; the queue is rendered where the crew is; and the unit + e2e proofs exist.
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

// 1. Migration and mirror.
const canonical = "db/migrations/0025_live_chat_moderation.sql";
const canonicalSql = read(canonical);
const mirrorDir = "supabase/migrations";
const mirrors = fs.existsSync(mirrorDir) ? fs.readdirSync(mirrorDir).filter((name) => name.endsWith("_live_chat_moderation.sql")) : [];
if (mirrors.length !== 1) failures.push(`${mirrorDir} must contain exactly one *_live_chat_moderation.sql mirror (found ${mirrors.length})`);
for (const name of mirrors) if (read(path.join(mirrorDir, name)) !== canonicalSql) failures.push(`${mirrorDir}/${name} drifted from ${canonical}; copy the canonical file over it`);
for (const token of ["add column if not exists moderated_by", "add column if not exists moderated_at", "create table if not exists public.live_chat_moderation_states", "check (scope in ('room', 'attendee'))"]) {
  if (!canonicalSql.includes(token)) failures.push(`${canonical} missing: ${token}`);
}
requireTokens("scripts/validate_supabase_schema_parity.js", ["live_chat_moderation_states", '"moderated_by"']);
requireTokens("services/events/eventRepository.ts", ['["live_chat_moderation_states"']);

// 2. Both stores implement the moderation surface; the attendee default excludes hidden.
const storeMethods = ["listLiveChatMessages", "listRecentLiveChatMessages", "updateLiveChatMessageModeration", "setLiveChatModerationState", "getLiveChatModerationState", "listLiveChatModerationStates"];
requireTokens("services/runtime/runtimeStore.ts", [...storeMethods, "liveChatModerationStates", "includeHidden"]);
requireTokens("services/runtime/fileRuntimeStore.ts", [...storeMethods, 'options?.includeHidden || message.moderationStatus !== "hidden"']);
requireTokens("services/runtime/supabaseRuntimeStore.ts", [...storeMethods, 'if (!options?.includeHidden) query = query.neq("moderation_status", "hidden")', "live_chat_moderation_states", "moderated_by"]);

// 3. Rules live in the service write path, and the crew listing is explicit.
requireTokens("services/venue/liveChatService.ts", [
  "export async function postLiveRoomChatMessage",
  'if (attendee.silenced) return { ok: false, rejection: "silenced"',
  'if (room.locked) return { ok: false, rejection: "locked"',
  'includeHidden: viewer === "crew"',
  "export async function getLiveChatModerationQueue",
]);
requireTokens("types/liveChat.ts", ['LIVE_CHAT_SILENCED_MESSAGE = "You have been silenced by the crew"', 'LIVE_CHAT_LOCKED_MESSAGE = "Chat is locked by the crew"', "moderatedBy?: string"]);

// 4. Every crew action is guarded; the attendee action uses the guarded post path.
const actions = read("lib/actions/liveChatActions.ts");
for (const name of ["moderateLiveChatMessage", "silenceLiveChatAttendee", "lockLiveChatRoom"]) {
  const start = actions.indexOf(`export async function ${name}(`);
  if (start < 0) { failures.push(`liveChatActions.ts missing ${name}`); continue; }
  const body = actions.slice(start, actions.indexOf("\n}\n", start));
  if (!body.includes("await requireControl(eventId)")) failures.push(`${name} must call requireControl before mutating`);
}
requireTokens("lib/actions/liveChatActions.ts", ["requireLiveEventControlAccessForRequest", "postLiveRoomChatMessage("]);
forbidTokens("lib/actions/liveChatActions.ts", ["appendLiveRoomChatMessage("]);

// 5. Attendee chat renders the notices; the queue is on every crew surface.
requireTokens("components/venue/LiveRoomChat.tsx", ["chat-silenced-notice", "chat-locked-notice", "chat-hidden-tag", "LIVE_CHAT_SILENCED_MESSAGE", "LIVE_CHAT_LOCKED_MESSAGE", 'viewer = crewAuth.ok ? "crew" : "attendee"']);
requireTokens("components/moderation/ChatModerationQueue.tsx", ["chat-moderation-queue", "moderateLiveChatMessage", "silenceLiveChatAttendee", "lockLiveChatRoom", "Hidden by"]);
for (const surface of ["components/testing/TestingConsole.tsx", "components/production/ProductionCommandCenter.tsx"]) requireTokens(surface, ["<ChatModerationQueue eventId="]);
forbidTokens("components/production/ProductionCommandCenter.tsx", ["Moderation queue for room and attendee activity."]);

// 6. Proof exists.
requireTokens("tests/unit/liveChatModeration.test.ts", ["hide removes a message from the attendee listing", "silence rejects the attendee's post server-side", "lock rejects every attendee post", "refused without a crew, operator, or owner cookie"]);
requireTokens("tests/e2e/crew-chat-moderation.spec.ts", ["chat-silenced-notice", "chat-locked-notice", "chat-moderation-queue"]);

if (examined === 0) failures.push("validate_live_chat_moderation_contract examined zero files");
if (failures.length) {
  console.error("validate_live_chat_moderation_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_live_chat_moderation_contract: PASS — ${examined} files examined; static contract only, the applied schema is read from /api/runtime/health after deploy.`);
