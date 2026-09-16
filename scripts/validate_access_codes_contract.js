const fs = require("fs");
/**
 * Access codes (16 Sep 2026): one case convention (displayed uppercase, matched case-insensitively
 * ignoring spaces and dashes) at every gate and resolver; guest links prefill the right gate and
 * never auto-submit; custom codes are validated, unique, and a change rotates the old code out
 * (crew → host-link version, guest roles → the role's code version checked by the area layouts);
 * every gated area is in the middleware matcher; the proofs exist.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
check("lib/access/accessCodes.ts", ["export function codeKey", "export function codesMatch", "export function displayCode", "export function validateCustomCode", "{4,24}", "export function guestGatePath"]);
check("services/access/eventAccessResolver.ts", ["codesMatch(expected, normalizedRoleCode)", "codesMatch(eventCrewCode, password)", "findEventIndexRecord(hydrated?.id || eventCode)"]);
check("services/events/eventRepository.ts", ["codeKey(event.joinCode) === wanted"]);
check("app/production-access/special-guest/page.tsx", ["defaultValue={prefilledEvent}", "defaultValue={prefilledCode}", "guest-code-prefilled", 'error === "rotated"']);
if (/autoSubmit|requestSubmit|\.submit\(\)/.test(read("app/production-access/special-guest/page.tsx") + read("app/production-access/crew/page.tsx"))) throw new Error("A prefilled gate must never submit itself.");
check("app/production-access/crew/page.tsx", ["defaultValue={prefilledCode}"]);
check("services/events/accessCodeService.ts", ["export async function setEventAccessCode", "export function codeIsFree", "validateCustomCode(input.value, field)", "revokeHostLinks(eventId, actor, stored)", "bumpAccessCodeVersion(eventId, field)", "export async function guestAccessStale"]);
for (const gate of ["app/production-access/special-guest/page.tsx", "app/api/production-access/special-guest/route.ts"]) check(gate, ["getAccessCodeVersions(access.eventId)", "codeVersion, issuedAt"]);
for (const layout of ["app/speaker/events/[eventId]/layout.tsx", "app/sponsor/events/[eventId]/layout.tsx", "app/client/[clientSlug]/events/[eventId]/layout.tsx"]) check(layout, ["guestAccessStale(", 'redirect("/production-access/special-guest?error=rotated")']);
check("components/venue/VipLobbyPanel.tsx", ["guestAccessStale(eventId)"]);
check("components/events/EventAccessCodesPanel.tsx", ["displayCode(", "guestGatePath(event, row.key)", 'testId={`copy-${row.key}-link`}', 'action="manage_access_codes"', "code-regenerate-", "code-save-"]);
check("components/events/EventJoinCodePanel.tsx", ["displayCode(event.joinCode)"]);
check("components/moderation/SpeakerRosterPanel.tsx", ["copy-speaker-link", 'guestGatePath(event, "speaker")']);
check("lib/actions/accessCodeActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "manage_access_codes")', "setEventAccessCode(eventId, field"]);
if (!/manage_access_codes: \["executive_producer", "producer"\]/.test(read("tests/unit/crewRolePermissions.test.ts"))) throw new Error("manage_access_codes belongs to executive_producer and producer (plus owner/operator).");
// Every gated area is in the middleware matcher and lands on its gate without a cookie.
const middleware = check("middleware.ts", ['"/app/:path*"', '"/admin/:path*"', '"/billing"', '"/client/:path*"', '"/crew/:path*"', '"/speaker/:path*"', '"/sponsor/:path*"', "specialGuestEntryPathFor(pathname)"]);
void middleware;
check("tests/unit/accessCodes.test.ts", ["matches a role code typed lowercase, mixed, with spaces, or without the dash", "two codes differing only by case"]);
check("tests/unit/accessCodeService.test.ts", ["a code differing only by case cannot coexist", "a guest cookie minted before a role-code change is stale"]);
check("tests/e2e/access-codes-and-links.spec.ts", ["every gated area sends a fresh browser to its gate", "custom code rotates the old one out", "guest-code-prefilled"]);
if (examined < 18) throw new Error(`validate_access_codes_contract examined only ${examined} files`);
console.log(`validate_access_codes_contract: PASS — ${examined} files examined; the matching itself is proven by tests/unit/accessCodes.test.ts and tests/e2e/access-codes-and-links.spec.ts.`);
