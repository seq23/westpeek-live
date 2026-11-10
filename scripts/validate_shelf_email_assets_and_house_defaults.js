// The operator-reachable Settings page never renders access codes or master
// passwords: those belong in the owner-only vault. Trimmed 10 Nov 2026 to this
// rule (hostile review of the validator cut).
const fs = require("fs");
const files = ["app/app/settings/page.tsx", "components/settings/HouseDefaultsPanel.tsx"];
for (const f of files) if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
const page = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const found = ["accessCode", "masterPassword", "OWNER_MASTER", "joinCode"].filter((t) => page.includes(t));
if (found.length) { console.error(`validate_shelf_email_assets_and_house_defaults: FAIL — Settings renders ${found.join(", ")}; codes and master passwords belong in the owner-only vault.`); process.exit(1); }
console.log(`validate_shelf_email_assets_and_house_defaults: PASS — ${files.length} Settings files carry no code or master password.`);
