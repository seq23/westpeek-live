const fs = require("fs");
/**
 * The owner's code scheme (16 Sep 2026): every code for an event is WPL-[ROLE-]STEM, where the stem
 * is the first six letters of the event's own name — one stem to remember, the role written into
 * the code. Two live events never share a stem. Because the codes are derivable from a public event
 * name on purpose, the protection lives at the gate: a few wrong codes from one place, then a short
 * cooldown, and every failed privileged attempt is logged with the role, the event and the time —
 * never the value that was typed.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

const codes = check("lib/access/accessCodes.ts", ['CODE_PREFIX = "WPL"', "export function codeStem", "export function derivedCodes", "export function roleCodeForStem", "export function stemFromCode", "export function isLegacyGeneratedCode", "export function stemForEvent", "STEM_LENGTH = 6"]);
for (const role of ["CREW", "SPEAKER", "SPONSOR", "CLIENT", "VIP"]) if (!codes.includes(`${role}"`)) throw new Error(`ROLE_SEGMENT is missing ${role}`);
if (/randomCode|Math\.random/.test(codes)) throw new Error("The scheme is readable: no random tail belongs in the code shape.");

const repository = check("services/events/eventRepository.ts", ["export async function freeCodeStem", "export function codesFromStem", "codesFromStem(await freeCodeStem(name, slug))", "status !== \"archived\""]);
if (!repository.includes("takenKeys")) throw new Error("Stem selection must check every other live event's codes.");

check("services/events/accessCodeService.ts", ["export async function adoptReadableCodes", "export function codeSchemeSummary", "includeCustom", "isLegacyGeneratedCode"]);
check("lib/actions/accessCodeActions.ts", ["adoptReadableCodesAction", 'requireLiveEventControlAccessForRequest(eventId, "manage_access_codes")']);
check("components/owner/AccessCodesVaultTable.tsx", ["vault-stem-", "vault-adopt-", "vault-custom-", "adoptReadableCodesAction", "WPL-[ROLE-]"]);

// The gate pays for the readability.
const limiter = check("services/access/gateAttemptLimiter.ts", ["ATTEMPT_LIMIT", "COOLDOWN_MS", "export function checkGateAttempts", "export function recordGateFailure", "export function clearGateAttempts", "sha256Hex"]);
if (/password|roleCode|value/.test(limiter.replace(/\/\*[\s\S]*?\*\//g, ""))) throw new Error("The limiter must never see or store what was typed.");
for (const gate of ["app/api/production-access/crew/route.ts", "app/api/production-access/special-guest/route.ts"]) {
  const body = check(gate, ["checkGateAttempts(", "recordGateFailure(", "clearGateAttempts(", "ipHash", "error=too_many"]);
  if (/reason: `?[^`\n]*\$\{(password|roleCode)\}/.test(body)) throw new Error(`${gate} must never log the attempted value`);
}
for (const page of ["app/production-access/crew/page.tsx", "app/production-access/special-guest/page.tsx"]) check(page, ['error === "too_many"', "gate-too-many"]);

check("tests/unit/readableAccessCodes.test.ts", ["takes the first six letters", "two events that want the same stem never share a code", "a hand-set code wins and survives adopting"]);
check("tests/unit/gateAttemptLimiter.test.ts", ["lets an honest mistype through", "cools down after the limit"]);
if (examined < 12) throw new Error(`validate_readable_access_codes examined only ${examined} files`);
console.log(`validate_readable_access_codes: PASS — ${examined} files examined; WPL-[ROLE-]STEM everywhere, stems unique across live events, gates rate-limited and failures logged without the value.`);
