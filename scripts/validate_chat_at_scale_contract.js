#!/usr/bin/env node
// Chat at scale contract: slow mode, the per-person rate limit, delta polling, and Clear chat.
//
// Proves, statically, that the four controls exist where they have to exist rather than only in the
// UI: the 0033 migration and its Supabase mirror are byte-identical and register the archive
// columns and the rate table; both runtime stores implement the delta read, the archive write, and
// the rate row; slow mode and the flood guard are enforced in the SERVICE write path; the exemption
// is read from cookies, never from a form field; Clear chat archives (there is no delete path); the
// delta endpoint exists and the client polls it with a cursor; the crew controls are guarded and
// rendered where the crew is; the chat still fails soft; and the unit + e2e proofs exist.
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

// 1. Migration and mirror. Slow mode deliberately has no column — it rides the room's jsonb state.
const canonical = "db/migrations/0034_live_chat_scale_controls.sql";
const canonicalSql = read(canonical);
const mirrorDir = "supabase/migrations";
const mirrors = fs.existsSync(mirrorDir) ? fs.readdirSync(mirrorDir).filter((name) => name.endsWith("_live_chat_scale_controls.sql")) : [];
if (mirrors.length !== 1) failures.push(`${mirrorDir} must contain exactly one *_live_chat_scale_controls.sql mirror (found ${mirrors.length})`);
for (const name of mirrors) {
  if (read(path.join(mirrorDir, name)) !== canonicalSql) failures.push(`${mirrorDir}/${name} drifted from ${canonical}; copy the canonical file over it`);
  if (name.replace(/_.*$/, "") <= "20260916190000") failures.push(`${mirrorDir}/${name} must be timestamped after 20260916190000 or it applies out of order`);
}
for (const token of ["add column if not exists archived_at", "add column if not exists archived_by", "create table if not exists public.live_chat_post_rates", "live_chat_messages_moderated_idx"]) {
  if (!canonicalSql.includes(token)) failures.push(`${canonical} missing: ${token}`);
}
requireTokens("scripts/validate_supabase_schema_parity.js", ["live_chat_post_rates", '"archived_at"']);
requireTokens("services/events/eventRepository.ts", ['["live_chat_post_rates"']);
requireTokens("types/runtimeEvent.ts", ["LIVE_CHAT_SCALE_MIGRATION_FILE", "0034_live_chat_scale_controls.sql"]);

// 2. Both stores implement the delta read, the archive write, and the rate row; archived rows leave
//    every listing, crew included.
const storeMethods = ["listLiveChatMessagesSince", "archiveLiveChatRoomMessages", "getLiveChatRateState", "setLiveChatRateState"];
requireTokens("services/runtime/runtimeStore.ts", [...storeMethods, "liveChatRateStates"]);
requireTokens("services/runtime/fileRuntimeStore.ts", [...storeMethods, "!message.archivedAt"]);
requireTokens("services/runtime/supabaseRuntimeStore.ts", [...storeMethods, '.is("archived_at", null)', "live_chat_post_rates", "archived_at.gt."]);

// 3. The rules live on the WRITE path. Slow mode, then the flood guard, then the append.
requireTokens("services/venue/liveChatRateLimit.ts", ["LIVE_CHAT_RATE_BURST", "LIVE_CHAT_RATE_SUSTAINED", "LIVE_CHAT_RATE_COOLDOWN_MS", "export function applyLiveChatRate"]);
const service = read("services/venue/liveChatService.ts");
for (const token of [
  'if (room.slowModeSeconds && !slowModeExempt(posterClass))',
  'return { ok: false, rejection: "slow_mode"',
  "const rate = applyLiveChatRate(",
  'return { ok: false, rejection: "rate_limited"',
  "export async function clearLiveChatRoom",
  "export async function setLiveChatSlowMode",
  "export async function listLiveRoomChatDelta",
  "archiveLiveChatRoomMessages(",
]) if (!service.includes(token)) failures.push(`services/venue/liveChatService.ts missing required token: ${token}`);
// Clear chat archives. A hard delete of a room's messages must never appear on this path.
forbidTokens("services/venue/liveChatService.ts", ["deleteLiveChatMessages", "hardDeleteLiveChat"]);
// The flood guard is not behind the slow-mode exemption: it runs for every poster class.
const postStart = service.indexOf("export async function postLiveRoomChatMessage");
const postBody = service.slice(postStart, service.indexOf("\n}\n", postStart));
if (postBody.indexOf("applyLiveChatRate(") < 0) failures.push("postLiveRoomChatMessage must call applyLiveChatRate");
if (/slowModeExempt\([\s\S]*applyLiveChatRate\(/.test(postBody) && /if \(slowModeExempt[\s\S]*applyLiveChatRate/.test(postBody)) failures.push("the rate limit must not be skipped for exempt posters; it is always on");

// 4. The exemption is read from the cookies, never from a form field.
requireTokens("lib/auth/liveChatPoster.ts", ["requireLiveEventControlAccessForRequest", 'return "speaker"', 'return "attendee"']);
requireTokens("lib/actions/liveChatActions.ts", ["const posterClass = await getLiveChatPosterClass(eventId)", "posterClass }", "setLiveChatSlowModeAction", "clearLiveChatRoomAction"]);
forbidTokens("lib/actions/liveChatActions.ts", ['field(formData, "posterClass")']);
const actions = read("lib/actions/liveChatActions.ts");
for (const name of ["setLiveChatSlowModeAction", "clearLiveChatRoomAction"]) {
  const start = actions.indexOf(`export async function ${name}(`);
  if (start < 0) { failures.push(`liveChatActions.ts missing ${name}`); continue; }
  const body = actions.slice(start, actions.indexOf("\n}\n", start));
  if (!body.includes("await requireControl(eventId)")) failures.push(`${name} must call requireControl before mutating`);
}
requireTokens("services/audit/auditTypes.ts", ["chat_slow_mode_on", "chat_room_cleared"]);

// 5. Delta polling: the endpoint exists, the client sends a cursor, and it does not refetch the window.
requireTokens("app/api/venue/chat/route.ts", ["listLiveRoomChatDelta", 'url.searchParams.get("since")', "cache-control"]);
requireTokens("components/venue/LiveRoomChatStream.tsx", ["/api/venue/chat?", "since=", "cursor.current", "removedIds", "clearedAt", "router.refresh()"]);
forbidTokens("components/venue/LiveRoomChatStream.tsx", ["listLiveRoomChatMessages"]);
requireTokens("types/liveChat.ts", ["LiveChatDelta", "removedIds", "LIVE_CHAT_SLOW_MODE_OPTIONS", "archivedAt?: string"]);

// 6. The surfaces: the composer counts down, the crew card carries both controls, the shell fails soft.
requireTokens("components/venue/LiveChatComposer.tsx", ["chat-slow-mode-countdown", "chat-slow-mode-exempt", "disabled={waiting}"]);
requireTokens("components/venue/LiveRoomChat.tsx", ["LiveRoomChatStream", "LiveChatComposer", "chat-slow-mode-badge", "liveChatCursorOf"]);
requireTokens("components/moderation/ChatModerationQueue.tsx", ["SlowModeForm", "ClearChatControl", "setLiveChatSlowModeAction", "clearLiveChatRoomAction"]);
requireTokens("components/moderation/ClearChatControl.tsx", ["window.confirm", "cannot be undone", "archived", "message${messageCount === 1"]);
// Fail soft: every surface that renders the chat still does so through SafeSection.
for (const surface of ["components/venue/MainStageLiveChat.tsx", "components/venue/BreakoutRoomExperience.tsx", "components/venue/VipLobbyPanel.tsx"]) {
  requireTokens(surface, ["SafeSection", "=> LiveRoomChat({"]);
}
requireTokens("app/api/venue/chat/route.ts", ["} catch", "ok: false"]);

// 7. Proof exists.
requireTokens("tests/unit/liveChatAtScale.test.ts", [
  "slow mode blocks a second post inside the window and allows it once the window has passed",
  "crew, the host, and speakers are exempt from slow mode",
  "the rate limit refuses server-side with a sentence, with slow mode off and the UI bypassed",
  "the delta returns only what is new, and a hide comes back as a removal",
  "clear chat empties the room for a second viewer, archives rather than deletes",
]);
requireTokens("tests/e2e/chat-at-scale.spec.ts", ["chat-slow-mode-countdown", "chat-clear-main_stage-main-stage", "data-message-count"]);

if (examined === 0) failures.push("validate_chat_at_scale_contract examined zero files");
if (failures.length) {
  console.error("validate_chat_at_scale_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_chat_at_scale_contract: PASS — ${examined} files examined; static contract only, the applied schema is read from /api/runtime/health after deploy.`);
