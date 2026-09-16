#!/usr/bin/env node
// Intentional end vs dropped feed + LiveKit webhook registration help.
// Proves, statically, that: ingress_ended on an already-ended event does not fail over (in the one
// place both the webhook and the polled reconcile pass through); End the show is a guarded action
// backed by a non-action service; the control renders where the crew is; the stage actions are all
// guarded; the poll records a heartbeat so the console can name which path is live; the webhook
// URL and instruction are shown and documented; and the unit + e2e proofs exist. Hard-fails on zero
// examined items.
const fs = require("fs");

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

// 1. One choke point for both orders.
requireTokens("services/video/stageStreamStateService.ts", ["export async function eventIsEnded", 'input.signal === "ingress_ended" && !stored.operatorMarkedShowEnded && (await eventIsEnded(input.eventId))', "export async function recordStagePollHeartbeat", "if (state.operatorMarkedShowEnded) {", 'state.streamStatus = "ENDED";']);
requireTokens("services/video/livekitIngressService.ts", ["await recordStagePollHeartbeat(eventId, stageId)", 'signal: "ingress_ended"']);
requireTokens("app/api/video/livekit-webhook/route.ts", ['signal: "ingress_ended"', "applyStageStreamSignal("]);

// 2. End the show: guarded action, service body, event status.
requireTokens("services/video/showEndService.ts", ["export async function endShowForEvent", 'signal: "operator_mark_show_ended"', 'setEventStatus(input.eventId, "ended"', "Not a server action"]);
forbidTokens("services/video/showEndService.ts", ['"use server"']);
const actions = read("lib/actions/stageStreamActions.ts");
for (const name of ["generateStreamYardCredentials", "applyStageStreamOperatorSignal", "endTheShow"]) {
  const start = actions.indexOf(`export async function ${name}(`);
  if (start < 0) { failures.push(`stageStreamActions.ts missing ${name}`); continue; }
  const body = actions.slice(start, actions.indexOf("\n}\n", start));
  if (!body.includes("await requireControl(eventId)")) failures.push(`${name} must call requireControl before mutating`);
}
requireTokens("lib/actions/stageStreamActions.ts", ["requireLiveEventControlAccessForRequest", "endShowForEvent("]);

// 3. Where the crew is.
requireTokens("components/moderation/EndShowControl.tsx", ["end-show-control", "end-show-button", "end-show-ended-badge", "endTheShow", "Press before you stop the feed"]);
requireTokens("components/moderation/CrewLiveModerationDeck.tsx", ["<EndShowControl eventId="]);
requireTokens("components/events/EventPublishPanel.tsx", ["<EndShowControl eventId="]);
requireTokens("components/testing/StreamYardIngressPanel.tsx", ["<EndShowControl eventId=", "livekit-webhook-help", "livekit-webhook-url", "Settings → Webhooks", "None yet — polling is carrying the state (every ~10s)", "LIVEKIT_API_SECRET", "LIVEKIT_WEBHOOK_SECRET"]);
requireTokens("lib/runtime/appBaseUrl.ts", ['LIVEKIT_WEBHOOK_PATH = "/api/video/livekit-webhook"', "export async function livekitWebhookUrl"]);
requireTokens("components/events/EventJoinCodePanel.tsx", ['from "@/lib/runtime/appBaseUrl"']);

// 4. Documented for the operator.
requireTokens("docs/LIVEKIT_WEBHOOKS.md", ["https://westpeek.live/api/video/livekit-webhook", "Settings → Webhooks", "LIVEKIT_API_SECRET", "LIVEKIT_WEBHOOK_SECRET", "polling is carrying the state", "Intentional end vs dropped feed"]);
requireTokens("docs/ACTIVE_DOCS.md", ["docs/LIVEKIT_WEBHOOKS.md"]);

// 5. Proof.
requireTokens("tests/unit/endShowOrdering.test.ts", ["order A: End the show first", "order B: the event is already ended", "the polled reconcile honours both orders", "still fails a live event over to Daily", "refused without a crew, operator, or owner cookie"]);
requireTokens("tests/e2e/end-the-show.spec.ts", ["end-show-button", "ingress_ended", 'toBe("ENDED")', 'toBe("DAILY")', "livekit-webhook-url", "last-webhook-card"]);

if (examined === 0) failures.push("validate_end_show_contract examined zero files");
if (failures.length) {
  console.error("validate_end_show_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_end_show_contract: PASS — ${examined} files examined; static contract only.`);
