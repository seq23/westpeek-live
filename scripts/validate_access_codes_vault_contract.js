const fs = require("fs");
const path = require("path");
/**
 * The access-codes vault (16 Sep 2026): the owner asked for one place to look codes up, replacing
 * the v2 manual that printed them in a document. It lives in the Owner Console behind the owner
 * master key — an operator or crew session must not see it — every per-event code is masked until
 * Reveal, and the four GLOBAL gates are Cloudflare secrets whose VALUES no route, component or
 * action may ever render.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
const vault = check("components/owner/AccessCodesVault.tsx", ['actor?.kind !== "owner"', "vault-owner-only", "OWNER_MASTER_ACCESS_PASSWORD", "OPERATOR_LAUNCHPAD_PASSWORD", "CREW_ACCESS_PASSWORD", "npx wrangler secret put", "vault-gate-", "never shown here"]);
if (/\{\s*env\.(OWNER_MASTER_ACCESS_PASSWORD|OPERATOR_LAUNCHPAD_PASSWORD|CREW_ACCESS_PASSWORD)/.test(vault)) throw new Error("The vault must render SET / NOT SET, never a global secret's value.");
check("components/owner/AccessCodesVaultTable.tsx", ["vault-search", "vault-copy-all-", "vault-reveal-", "vault-rotate-", "setEventAccessCodeAction", "recordCodeVaultViewAction", "window.confirm", "stops working immediately"]);
check("lib/actions/accessCodeAuditActions.ts", ['actor?.kind !== "owner"', "access_code_revealed", "access_code_copied"]);
check("components/owner/OwnerConsole.tsx", ['id="access-codes"', "AccessCodesVault()", '{ id: "access-codes", label: "Access codes" }']);
check("tests/e2e/access-codes-vault.spec.ts", ["operator", "vault-reveal-", "rotate"]);
// Nothing anywhere may print a global gate's value.
const roots = ["app", "components", "lib/actions"];
const offenders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const body = fs.readFileSync(full, "utf8");
    examined += 1;
    for (const key of ["OWNER_MASTER_ACCESS_PASSWORD", "OPERATOR_LAUNCHPAD_PASSWORD", "CREW_ACCESS_PASSWORD"]) {
      const printed = new RegExp(`\\{[^}\\n]*\\b(env|process\\.env)[^}\\n]*\\b${key}\\b[^}\\n]*\\}`).test(body);
      if (printed) offenders.push(`${full} renders ${key}`);
    }
  }
};
for (const root of roots) walk(root);
if (offenders.length) throw new Error(`A global access secret is rendered: ${offenders.join("; ")}`);
if (examined < 50) throw new Error(`validate_access_codes_vault_contract examined only ${examined} files`);
console.log(`validate_access_codes_vault_contract: PASS — ${examined} files examined; no route or component renders a global gate's value.`);
