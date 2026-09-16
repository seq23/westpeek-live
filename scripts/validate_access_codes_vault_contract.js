const fs = require("fs");
const path = require("path");
/**
 * The access-codes vault (16 Sep 2026). One place to look every code up, replacing the v2 manual
 * that printed them in a document. It lives in the Owner Console behind the owner master key — an
 * operator or crew session must not see it at all — and the owner asked for the real gate
 * passwords there, because she is the one who has to type them again:
 *   · OWNER_MASTER_ACCESS_PASSWORD, OPERATOR_LAUNCHPAD_PASSWORD and CREW_ACCESS_PASSWORD render
 *     their values, masked until Reveal, with Copy and the rotation command;
 *   · OWNER_MASTER_ACCESS_PASSWORD_2, the spare, is reported set / not set and NEVER rendered;
 *   · nothing outside the owner-gated vault may render any of them, they never reach a URL or a
 *     log line, and the Owner Console response is no-store.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
const vault = check("components/owner/AccessCodesVault.tsx", ['actor?.kind !== "owner"', "vault-owner-only", "OWNER_MASTER_ACCESS_PASSWORD", "OPERATOR_LAUNCHPAD_PASSWORD", "CREW_ACCESS_PASSWORD", "SPARE_GATE", "GlobalGatesPanel"]);
if (!vault.includes("const spareSet = Boolean(value(SPARE_GATE[0]))")) throw new Error("The spare owner master password must be reported set / not set only.");
if (/spare=\{\{[^}]*value:/.test(vault)) throw new Error("The spare owner master password's value must never be passed to the client.");
const gates = check("components/owner/GlobalGatesPanel.tsx", ["vault-gate-reveal-", "vault-gate-copy-", "vault-gate-value-", "recordCodeVaultViewAction", "mask("]);
if (/console\.(log|error|warn|info)/.test(gates)) throw new Error("A gate password must never be logged.");
if (/href=|URLSearchParams|location\.search/.test(gates)) throw new Error("A gate password must never reach a URL.");
if (gates.includes("spare.value")) throw new Error("The spare key panel must not read a value it should not have.");
const middleware = read("middleware.ts"); examined += 1;
if (!middleware.includes('pathname === "/app/owner"') || !middleware.includes("no-store")) throw new Error("The Owner Console response must be no-store: it carries the gate passwords.");
check("components/owner/AccessCodesVaultTable.tsx", ["vault-search", "vault-copy-all-", "vault-reveal-", "vault-rotate-", "setEventAccessCodeAction", "recordCodeVaultViewAction", "window.confirm", "stops working immediately"]);
check("lib/actions/accessCodeAuditActions.ts", ['actor?.kind !== "owner"', "access_code_revealed", "access_code_copied"]);
check("components/owner/OwnerConsole.tsx", ['id="access-codes"', "AccessCodesVault()", '{ id: "access-codes", label: "Access codes" }']);
check("tests/e2e/access-codes-vault.spec.ts", ["operator", "vault-reveal-", "rotate", "OWNER_MASTER_ACCESS_PASSWORD_2"]);

// Nothing outside the owner-gated vault may render a gate password.
const readers = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    examined += 1;
    if (full === path.join("components", "owner", "AccessCodesVault.tsx") || full === path.join("components", "owner", "GlobalGatesPanel.tsx")) continue;
    const body = fs.readFileSync(full, "utf8");
    for (const key of ["OWNER_MASTER_ACCESS_PASSWORD", "OPERATOR_LAUNCHPAD_PASSWORD", "CREW_ACCESS_PASSWORD"]) {
      if (new RegExp(`\\{[^}\\n]*\\b(env|process\\.env)[^}\\n]*\\b${key}\\b[^}\\n]*\\}`).test(body)) readers.push(`${full} renders ${key}`);
    }
  }
};
for (const root of ["app", "components"]) walk(root);
if (readers.length) throw new Error(`A gate password is rendered outside the owner-gated vault: ${readers.join("; ")}`);

const route = read("app/production-access/launchpad/page.tsx");
examined += 1;
if (!route.includes("readV5AccessCookie")) throw new Error("Operator Launchpad route must remain behind the operator production gate.");
if (examined < 50) throw new Error(`validate_access_codes_vault_contract examined only ${examined} files`);
console.log(`validate_access_codes_vault_contract: PASS — ${examined} files examined; gate passwords render only inside the owner-gated vault, the spare key never, and the Owner Console response is no-store.`);
