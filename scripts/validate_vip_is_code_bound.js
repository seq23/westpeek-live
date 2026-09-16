const fs = require("fs");
/**
 * VIP is a credential, not a checkbox (the owner, 16 Sep 2026: "someone cannot be vip unless they
 * have a code or someone official makes them one — 'make VIP' should require a code"). Every route
 * into VIP goes through one writer that stamps the event's current VIP code version onto the grant,
 * so rotating the VIP code revokes everyone admitted under the old one — crew grants included.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

const service = check("services/guests/vipGrantService.ts", ["async function vipCodeVersion", "async function writeGrant", "export async function grantVip", "export async function revokeVip", "export async function redeemVipCode", "export async function admitInvitedVip", "codesMatch(typedCode, expected)", "grant.codeVersion < currentVersion"]);
if (!/const codeVersion = await vipCodeVersion\(eventId\);/.test(service)) throw new Error("A grant must take its code version from the event, never from the caller.");
if (/codeVersion:\s*(0|input\.|options\.)/.test(service)) throw new Error("Nothing may pass a code version in: it is read from the event.");
const writers = service.match(/writeGrant\(/g) || [];
if (writers.length !== 3) throw new Error(`writeGrant must be the single writer (definition + grantVip + revokeVip); found ${writers.length} references`);

const actions = check("lib/actions/vipActions.ts", ["makeVipAction", "removeVipAction", "setVipInviteListAction", "redeemVipCodeAction", 'requireLiveEventControlAccessForRequest(eventId, "manage_stage_access")', 'source: "crew_grant"']);
if (/hiddenFromDirectory|isVip\s*=\s*true|vip:\s*true/.test(actions)) throw new Error("No action may set a VIP flag directly.");

check("components/moderation/VipRowControl.tsx", ["makeVipAction", "removeVipAction", "make-vip-", "remove-vip-", "send them", "vip-why-"]);
check("components/moderation/AttendeeLiveRoster.tsx", ["VipRowControl", "listVipStanding(", "vipCodeFor("]);
check("components/owner/VipRow.tsx", ["listVipStanding(", "getVipInviteList(", "console-vip-", "code v", "pre-authorisation of the code"]);
check("components/owner/OwnerConsole.tsx", ['id="vips"', "VipRow({ event })"]);
check("components/venue/VipCodeCard.tsx", ["redeemVipCodeAction", "vip-code-input", "Register first"]);
check("app/venue/[eventId]/lobby/page.tsx", ["VipCodeCard", "vipStandingFor("]);
check("services/attendees/attendeeRegistrationService.ts", ["admitInvitedVip("]);
check("types/specialGuest.ts", ['"vip_grant"', '"vip_invites"', "VipGrantSource", "codeVersion: number"]);
check("tests/unit/vipCodeBound.test.ts", ["rotating the VIP code revokes everyone admitted under the old one", "the invite list is a pre-authorisation of the code"]);
if (examined < 10) throw new Error(`validate_vip_is_code_bound examined only ${examined} files`);
console.log(`validate_vip_is_code_bound: PASS — ${examined} files examined; every VIP traces to the event's VIP code, with the version it was issued under.`);
