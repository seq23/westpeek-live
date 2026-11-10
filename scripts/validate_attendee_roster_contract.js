#!/usr/bin/env node
// Every mutating attendee-roster action awaits requireControl(eventId) before it
// changes anything. Trimmed 10 Nov 2026 to this rule (hostile review of the
// validator cut). Hard-fails when an action it names is missing.
const fs = require("fs");
const file = "lib/actions/attendeeLiveActions.ts";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
const actions = fs.readFileSync(file, "utf8");
const failures = [];
const names = ["decideAttendeeLiveAccess", "setAttendeeLiveApproval", "updateAttendeeLiveControl"];
for (const name of names) {
  const start = actions.indexOf(`export async function ${name}(`);
  if (start < 0) { failures.push(`${file} missing ${name}`); continue; }
  const body = actions.slice(start, actions.indexOf("\n}\n", start));
  if (!body.includes("await requireControl(eventId)")) failures.push(`${name} must call requireControl before mutating`);
}
if (failures.length) { console.error("validate_attendee_roster_contract: FAIL\n- " + failures.join("\n- ")); process.exit(1); }
console.log(`validate_attendee_roster_contract: PASS — ${names.length} roster actions await requireControl.`);
