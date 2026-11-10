// Nothing emails attendees on its own: the send action is access-guarded and
// nothing sends on a timer. Trimmed 10 Nov 2026 to this rule (hostile review of
// the validator cut); "no recipients" is unit-tested in eventEmail.test.ts.
const fs = require("fs");
const read = (f) => { if (!fs.existsSync(f)) throw new Error(`Missing ${f}`); return fs.readFileSync(f, "utf8"); };
const failures = [];
const actions = read("lib/actions/eventEmailActions.ts");
if (!actions.includes('requireLiveEventControlAccessForRequest(eventId, "manage_access_codes")')) failures.push("the email send action must be access-guarded");
if (!actions.includes("sendManualWorkflow(")) failures.push("the email action no longer sends through sendManualWorkflow, so this check examined nothing");
if (/setInterval|cron|scheduled/.test(actions)) failures.push("nothing may send on a timer");
const service = read("services/email/eventEmailService.ts");
if (!service.includes("isManualWorkflow(input.workflow)")) failures.push("only workflows a person sends by hand may be sent by hand");
for (const dir of [".github/workflows"]) {
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const y = fs.readFileSync(`${dir}/${f}`, "utf8");
    if (/schedule:/.test(y) && /sendManualWorkflow|eventEmailActions|send-event-email/.test(y)) failures.push(`${dir}/${f} sends attendee email on a schedule`);
  }
}
if (failures.length) { console.error("validate_event_email_real: FAIL\n- " + failures.join("\n- ")); process.exit(1); }
console.log("validate_event_email_real: PASS — the send is access-guarded and nothing sends on a timer.");
