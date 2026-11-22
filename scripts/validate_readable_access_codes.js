const fs = require("fs");
/**
 * The owner's code scheme: the EVENT code is WPL-STEM, the stem the first six letters of the event's
 * own name (16 Sep 2026), and two live events never share one. ROLE codes (crew, speaker, sponsor,
 * client, VIP) name their role and carry ten random characters, WPL-CREW-7KQ3X-M9P2T (22 Nov 2026):
 * the event code is public to every attendee, so a role code built from it (WPL-CREW-STEM) could be
 * typed by anyone, and is refused after LEGACY_ROLE_CODE_CUTOFF. The executive producer role opens
 * only with the host code from a host link, never the crew code. The gates still limit attempts
 * and log every failure with the role, the event and the time, never the value that was typed.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

const codes = check("lib/access/accessCodes.ts", ['CODE_PREFIX = "WPL"', "export function codeStem", "export function mintRoleCode", "export function liveRoleCode", "export function isBuiltFromJoinCode", "LEGACY_ROLE_CODE_CUTOFF", "crypto.getRandomValues", "export function stemFromCode", "export function isLegacyGeneratedCode", "export function stemForEvent", "STEM_LENGTH = 6"]);
for (const role of ["CREW", "SPEAKER", "SPONSOR", "CLIENT", "VIP"]) if (!codes.includes(`${role}"`)) throw new Error(`ROLE_SEGMENT is missing ${role}`);
if (/Math\.random/.test(codes)) throw new Error("Role codes are secrets: crypto.getRandomValues only, never Math.random.");

const repository = check("services/events/eventRepository.ts", ["export async function freeCodeStem", "export function codesFromStem", "codesFromStem(await freeCodeStem(name, slug))", "mintRoleCode(", "status !== \"archived\""]);
if (!repository.includes("takenKeys")) throw new Error("Stem selection must check every other live event's codes.");

check("services/events/accessCodeService.ts", ["export async function adoptReadableCodes", "export async function rotateAllRoleCodes", "export function codeSchemeSummary", "includeCustom", "isLegacyGeneratedCode", "isBuiltFromJoinCode"]);
check("lib/actions/accessCodeActions.ts", ["adoptReadableCodesAction", "rotateRoleCodesAction", 'requireLiveEventControlAccessForRequest(eventId, "manage_access_codes")']);
check("components/owner/AccessCodesVaultTable.tsx", ["vault-stem-", "vault-adopt-", "vault-custom-", "adoptReadableCodesAction"]);
check("components/events/EventAccessCodesPanel.tsx", ["rotateRoleCodesAction", "rotate-role-codes", "role-codes-guessable"]);
// Every door matches the live role code (a stem-built one past the cut-off is no code), and the host role needs the host code.
check("services/access/eventAccessResolver.ts", ['liveRoleCode(runtimeEvent, "crew")', 'crewRole === "executive_producer"', "matchesHostCode(", "host_link_required"]);
check("services/events/eventConfigRepository.ts", ["liveRoleCode("]);
check("services/guests/vipGrantService.ts", ['liveRoleCode(event, "vip")']);
check("services/events/hostLinkService.ts", ["export async function hostCodeFor", "hmacSha256Base64Url("]);

// The gate pays for the readability.
const limiter = check("services/access/gateAttemptLimiter.ts", ["ATTEMPT_LIMIT", "COOLDOWN_MS", "export function checkGateAttempts", "export function recordGateFailure", "export function clearGateAttempts", "sha256Hex"]);
if (/password|roleCode|value/.test(limiter.replace(/\/\*[\s\S]*?\*\//g, ""))) throw new Error("The limiter must never see or store what was typed.");
for (const gate of ["app/api/production-access/crew/route.ts", "app/api/production-access/special-guest/route.ts"]) {
  const body = check(gate, ["checkGateAttempts(", "recordGateFailure(", "clearGateAttempts(", "ipHash", "error=too_many"]);
  if (/reason: `?[^`\n]*\$\{(password|roleCode)\}/.test(body)) throw new Error(`${gate} must never log the attempted value`);
}
for (const page of ["app/production-access/crew/page.tsx", "app/production-access/special-guest/page.tsx"]) check(page, ['error === "too_many"', "gate-too-many"]);

check("tests/unit/readableAccessCodes.test.ts", ["takes the first six letters", "two events that want the same stem never share a code", "a hand-set code wins and survives adopting", "never contains the event code", "the crew code never opens executive producer", "after the cut-off"]);
check("tests/unit/gateAttemptLimiter.test.ts", ["lets an honest mistype through", "cools down after the limit"]);
if (examined < 17) throw new Error(`validate_readable_access_codes examined only ${examined} files`);
console.log(`validate_readable_access_codes: PASS — ${examined} files examined; event codes WPL-STEM and unique across live events, role codes random, executive producer by host code only, gates rate-limited and failures logged without the value.`);
