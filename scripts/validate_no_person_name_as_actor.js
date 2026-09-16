const fs = require("fs");
const path = require("path");
/**
 * Owner access is a shared master password. The app cannot know which human is holding it, so it
 * must never print one: the chip said "Sequoia Taylor / owner" on every owner session, and
 * showEndService stamped that name onto the actor recorded when a show ended — a false attribution
 * in the event's own history if Scooter ended it.
 *
 * No component or service may render a person's name as an owner/operator actor. Agency SETTINGS
 * data (a real member list the owner typed) is a different thing and is allowed.
 */
const NAMES = ["Sequoia Taylor", "Scooter Taylor"];
const ALLOWED = new Set([
  // Settings data: the agency's own member list, not a claim about who is acting.
  "services/agencies/agencySettingsService.ts",
  // The legal footer and brand marks name the company, not an actor.
  "components/legal/LegalFooter.tsx",
]);
const failures = [];
let examined = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    examined += 1;
    if (ALLOWED.has(full)) continue;
    const body = fs.readFileSync(full, "utf8");
    for (const name of NAMES) {
      if (body.includes(name)) failures.push(`${full} hard-codes "${name}" — owner access is shared; say "Owner", or use a real per-person identity`);
    }
  }
}
for (const root of ["components", "services", "lib", "app"]) walk(root);

const actor = fs.readFileSync("lib/auth/workspaceActor.ts", "utf8");
if (!/OWNER_ACTOR_LABEL = "Owner"/.test(actor)) failures.push("lib/auth/workspaceActor.ts must label the owner actor exactly \"Owner\"");
if (!actor.includes("ownerKeyLabel")) failures.push("lib/auth/workspaceActor.ts must expose which master key is in use (a fact) instead of a name (a guess)");
if (!examined) failures.push("validate_no_person_name_as_actor examined zero files");

if (failures.length) {
  console.error("validate_no_person_name_as_actor: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_no_person_name_as_actor: PASS — ${examined} files examined; no owner/operator actor carries a person's name.`);
