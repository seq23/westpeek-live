const fs = require("fs");

/**
 * Crew roles mean something and say so (16 Sep 2026). Static contract:
 *   one permission map (lib/auth/crewRolePermissions.ts) with every crew role;
 *   the live-control guard checks the named action against the role, owner/operator bypass;
 *   every deck server action names its action; every deck control is a GatedForm (no raw
 *   server-action form on a deck panel); every crew page shows the role badge with Switch role;
 *   the crew gate lists every role with its description and accepts event/role/code prefill;
 *   the unit, server-action, and Playwright proofs exist.
 */
function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, "utf8");
}
function requireTokens(file, tokens) {
  const body = read(file);
  const missing = tokens.filter((token) => !body.includes(token));
  if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`);
  return body;
}
let examined = 0;
function check(file, tokens) { requireTokens(file, tokens); examined += 1; }

const ROLES = ["crew", "executive_producer", "producer", "technical_director", "show_caller", "moderator", "va", "support"];
const map = read("lib/auth/crewRolePermissions.ts"); examined += 1;
for (const role of ROLES) for (const table of ["crewActionPermissions", "crewRoleLabels", "crewRoleDescriptions"]) {
  const section = map.slice(map.indexOf(`export const ${table}`));
  if (!new RegExp(`\\n\\s+${role}:`).test(section.slice(0, section.indexOf("};")))) throw new Error(`crewRolePermissions.ts: ${table} has no row for ${role}`);
}
for (const [action, mustHave, mustNot] of [
  ["go_live", ["executive_producer", "producer", "technical_director"], ["moderator", "show_caller", "crew", "support", "va"]],
  ["moderate_chat", ["moderator", "producer", "executive_producer", "show_caller"], ["technical_director", "crew", "support", "va"]],
  ["manage_stage_access", ["producer", "executive_producer", "show_caller", "moderator"], ["technical_director", "crew", "support", "va"]],
  ["manage_cue_cards", ["producer", "executive_producer", "show_caller"], ["moderator", "technical_director", "crew", "support", "va"]],
]) {
  const rows = map.slice(map.indexOf("export const crewActionPermissions"), map.indexOf("export const crewRoleLabels"));
  for (const role of ROLES) {
    const row = rows.match(new RegExp(`\\n\\s+${role}: \\[([^\\]]*)\\]`));
    if (!row) throw new Error(`crewActionPermissions has no row for ${role}`);
    const has = row[1].includes(`"${action}"`);
    if (mustHave.includes(role) && !has) throw new Error(`${role} must be allowed ${action}`);
    if (mustNot.includes(role) && has) throw new Error(`${role} must NOT be allowed ${action}`);
  }
}
if (!map.includes("export function crewDeniedReason")) throw new Error("crewDeniedReason missing: the deck and the server must share one sentence.");

check("lib/auth/liveControlRequestGuard.ts", ["export function authorizeLiveControl", "roleAllows(crewRole, action)", "crewDeniedReason(crewRole, action)", 'if (owner?.kind === "owner") return { ok: true', 'operator?.kind === "operator"']);
check("lib/auth/crewViewer.ts", ["export function crewViewerFromPayloads", "isHost: role === \"executive_producer\"", "export function viewerDenied"]);
check("lib/auth/requireCrewCapability.ts", ["operatorPayload?.kind === \"operator\""]);
check("lib/actions/stageStreamActions.ts", ['action: CrewAction = "go_live"', "requireLiveEventControlAccessForRequest(eventId, action)"]);
check("lib/actions/liveChatActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "moderate_chat")']);
check("lib/actions/attendeeLiveActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "manage_stage_access")']);
check("lib/actions/speakerStageActions.ts", ['requireControl(eventId, "manage_stage_access")', 'requireControl(eventId, "manage_cue_cards")']);

// Every deck panel: gated forms only, and the reason line.
for (const panel of ["components/moderation/EndShowControl.tsx", "components/moderation/LiveRoomControlForms.tsx", "components/moderation/SpeakerRosterPanel.tsx", "components/moderation/ChatModerationQueue.tsx", "components/moderation/AttendeeLiveRoster.tsx", "components/testing/StreamYardIngressPanel.tsx"]) {
  const body = check(panel, ["<GatedForm", "<DeniedNote", "getCrewViewer"]);
  const raw = (read(panel).match(/<form action=\{/g) || []).length;
  if (raw) throw new Error(`${panel}: ${raw} raw server-action form(s); every deck control must be a GatedForm so the role reason renders.`);
  void body;
}
check("components/moderation/GatedForm.tsx", ["fieldset disabled", "viewerDenied(viewer, permission)", "data-crew-denied"]);
check("components/moderation/CrewLiveModerationDeck.tsx", ["const viewer = await getCrewViewer(eventId)", "data-viewer-role", "includeEndShow: false"]);
check("components/crew/CrewInstructionShell.tsx", ["export function CrewRoleBadge", "You are in as {viewer.label}", 'data-testid="crew-switch-role"', "crew-role-description", "/production-access/crew?event="]);
check("app/production-access/crew/page.tsx", ["CREW_ROLES.map((role) =>", 'data-testid="crew-role-descriptions"', "crewRoleDescriptions[role]", "defaultValue={prefilledRole}", "defaultValue={prefilledEvent}", "defaultValue={prefilledCode}"]);
check("app/api/production-access/crew/route.ts", ["CREW_ROLES.includes(role as V4CrewRole)"]);

// Host = the executive_producer crew role for one event; host links; revocation rotates the crew code.
check("services/events/hostLinkService.ts", ["export function hostLinkPath", "role=executive_producer&code=", "export async function revokeHostLinks", "crew: mintAccessCodes().crew", "codeVersion: state.codeVersion + 1", "export function crewCookieCurrent"]);
check("lib/auth/liveControlRequestGuard.ts", ["crewCookieCurrent(crew.codeVersion, currentCodeVersion)", "REVOKED_HOST_LINK_ERROR"]);
check("lib/auth/crewViewer.ts", ["crewCookieCurrent(crew.codeVersion, currentCodeVersion)"]);
check("app/production-access/crew/page.tsx", ["codeVersion, issuedAt"]);
check("app/api/production-access/crew/route.ts", ["codeVersion, issuedAt"]);
check("lib/actions/hostActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "manage_host")', "mintHostLink(", "revokeHostLinks("]);
if (!/manage_host: \["executive_producer"\]/.test(read("tests/unit/crewRolePermissions.test.ts"))) throw new Error("manage_host must belong to the executive producer only (plus owner/operator).");
check("components/events/HostPanel.tsx", ["Make someone the host", "Send this to whoever is running the show. They get the host banner, go-live, end-the-show and every control for this event only.", "Revoke host link", 'testId="copy-host-link"', "You are hosting"]);
check("components/moderation/CrewLiveModerationDeck.tsx", ["=> HostPanel({ eventId"]);
check("app/app/events/[eventId]/access/page.tsx", ["=> HostPanel({ eventId"]);
check("app/venue/[eventId]/lobby/page.tsx", ["(await getCrewViewer(resolvedParams.eventId)).isHost", "crewHost={crewHost}"]);
// The four production-access cards explain themselves.
check("app/production-access/page.tsx", ["Sequoia and Scooter. The master password opens everything", "Separate operator password.", "People hired for the day", "Speakers, sponsors, VIPs, clients", "read-only overview for clients"]);
if (read("app/production-access/page.tsx").includes("Conference Special Guest")) throw new Error("The special-guest card must be named for the people it is for.");
check("scripts/post_deploy_role_flow_audit.js", ['"Speakers, sponsors, VIPs, clients"']);
check("tests/unit/hostLinks.test.ts", ["an executive_producer crew cookie is the host with every deck permission; plain crew is not", "revoke rotates the code and ends old cookies"]);
check("tests/e2e/host-link.spec.ts", ["mint a host link → the link prefills the gate → the host runs the show → revoke ends it", "the production-access cards explain the four doors"]);

// Proofs.
check("tests/unit/crewRolePermissions.test.ts", ["moderator cannot end the show; TD can", "executive_producer crew cookie is the host"]);
check("tests/unit/crewServerActionsByRole.test.ts", ["endTheShow(form({ eventId }))).rejects.toThrow(\"Moderator can't move the stream", "moderateLiveChatMessage(form("]);
check("tests/e2e/crew-roles-mean-something.spec.ts", ["expectDisabledWithReason(moderator.page, \"end-show-button\"", "technical director: can generate credentials and end the show", "crew-role-descriptions"]);
if (examined < 35) throw new Error(`validate_crew_role_permissions_contract examined only ${examined} files`);
console.log(`validate_crew_role_permissions_contract: PASS — ${examined} files examined; static contract, the role refusal itself is proven by tests/unit/crewServerActionsByRole.test.ts.`);
