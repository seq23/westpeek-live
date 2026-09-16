#!/usr/bin/env node
// Attendee roster + pending requests contract. Proves, statically, that the crew no longer needs a
// hand-typed attendee id: both runtime stores list capabilities; the roster service joins profiles,
// capability, silence, and last chat and bounds itself; the pending queue is fed by the attendee's
// request (requestStatus "requested"); one-click decisions are pure, guarded, and shared by the API
// route; the deck renders on the crew console and the command page (not only /admin/testing); and
// the unit + e2e proofs exist. Hard-fails on zero examined items.
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

// 1. Store listing in both implementations.
for (const file of ["services/runtime/runtimeStore.ts", "services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) requireTokens(file, ["listAttendeeLiveCapabilities"]);

// 2. Request → pending → decision are typed and pure.
requireTokens("types/attendeeLive.ts", ['requestStatus?: AttendeeLiveRequestDecision', '"requested" | "approved" | "declined"', '"permit" | "approve_publish" | "revoke" | "decline" | "reset"']);
requireTokens("services/venue/attendeeLivePermissionService.ts", ["export function decideCapability", "export function requestedCapability", "export async function applyAttendeeLiveDecision", "export async function recordAttendeeStageRequest", 'requestStatus: "requested"']);
requireTokens("services/venue/attendeeRosterService.ts", ["ROSTER_LIMIT = 200", "export async function getAttendeeRoster", "listAttendeeLiveCapabilities", "listLiveChatModerationStates", "listRecentLiveChatMessages", 'requestStatus === "requested"', "pending"]);

// 3. Actions are guarded and the attendee request records the pending status.
const actions = read("lib/actions/attendeeLiveActions.ts");
for (const name of ["decideAttendeeLiveAccess", "setAttendeeLiveApproval", "updateAttendeeLiveControl"]) {
  const start = actions.indexOf(`export async function ${name}(`);
  if (start < 0) { failures.push(`attendeeLiveActions.ts missing ${name}`); continue; }
  const body = actions.slice(start, actions.indexOf("\n}\n", start));
  if (!body.includes("await requireControl(eventId)")) failures.push(`${name} must call requireControl before mutating`);
}
requireTokens("lib/actions/attendeeLiveActions.ts", ["recordAttendeeStageRequest(", "applyAttendeeLiveDecision(", "removeLiveKitParticipantFromMainStage", "revalidateLiveSurfaces"]);
requireTokens("app/api/attendee-live/access/route.ts", ["applyAttendeeLiveDecision("]);

// 4. The deck lives where the crew is, and the testing console keeps working through the same component.
requireTokens("components/moderation/AttendeeLiveRoster.tsx", ["attendee-live-roster", "pending-stage-requests", "roster-search-form", "decideAttendeeLiveAccess", "silenceLiveChatAttendee", "Permit to watch", "Approve to publish", "Revoke"]);
requireTokens("components/moderation/CrewLiveModerationDeck.tsx", ["<AttendeeLiveRoster eventId=", "<ChatModerationQueue eventId=", "<LiveRoomControlForms eventId="]);
requireTokens("app/crew/events/[eventId]/page.tsx", ["<CrewLiveModerationDeck eventId=", "roster"]);
requireTokens("components/production/ProductionCommandCenter.tsx", ["<CrewLiveModerationDeck eventId="]);
requireTokens("components/testing/AttendeeLiveControlPanel.tsx", ["<AttendeeLiveRoster eventId=", "<LiveRoomControlForms eventId="]);
requireTokens("components/venue/AttendeeStageJoinControls.tsx", ["attendee-stage-request-pending", "attendee-stage-approved", "attendee-stage-request-declined"]);

// 5. Proof.
requireTokens("tests/unit/attendeeLiveRoster.test.ts", ["approve grants camera + mic + join and closes it", "pending requests oldest first", "refuses every decision without a crew, operator, or owner cookie", "bounded to the latest 200"]);
requireTokens("tests/e2e/crew-attendee-roster.spec.ts", ["pending-request-", "attendee-stage-approved", "attendee-live-access-revoked", "crew-live-moderation-deck", "grantCrewAccess("]);

if (examined === 0) failures.push("validate_attendee_roster_contract examined zero files");
if (failures.length) {
  console.error("validate_attendee_roster_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_attendee_roster_contract: PASS — ${examined} files examined; static contract only.`);
