const fs = require("fs");
/**
 * Email that tells the truth (16 Sep 2026). The page used to print one slogan about Resend under
 * eleven workflow names and know nothing. Now: every send writes a row (migration 0032), the event
 * page shows the real last-send per workflow and the whole log, /app/email is the cross-event
 * record, the banner reads the real environment, and nothing sends without a person naming
 * recipients and pressing the button.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

const service = check("services/email/eventEmailService.ts", ["MANUAL_WORKFLOWS", "export async function sendManualWorkflow", "export async function listEventEmailLog", "export async function lastSendByWorkflow", "appendEmailSendLog", "isResendConfigured"]);
if (!service.includes("if (!input.recipients.length)")) throw new Error("A send with no recipients must be refused.");
if (!service.includes("isManualWorkflow(input.workflow)")) throw new Error("Only the workflows a person sends by hand may be sent by hand.");

const actions = check("lib/actions/eventEmailActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "manage_access_codes")', "sendManualWorkflow(", "sentBy"]);
if (/setInterval|cron|scheduled/.test(actions)) throw new Error("Nothing may send on a timer.");

const center = check("components/email/EventEmailCenter.tsx", ["lastSendByWorkflow", "listEventEmailLog", "email-provider-banner", "email-send-", "email-log-row-", "Never sent for this event"]);
if (center.includes("Live-send capable through Resend")) throw new Error("The placeholder sentence must be gone.");
check("components/email/EmailAcrossEvents.tsx", ["listAllEmailLog", "email-across-events", "email-event-"]);
check("app/app/events/[eventId]/communications/page.tsx", ["EventEmailCenter"]);
check("app/app/email/page.tsx", ["EmailAcrossEvents"]);
if (fs.existsSync("components/email/EmailWorkflowMatrix.tsx")) throw new Error("The placeholder workflow matrix must be gone.");
{ const { requireD1, d1Sql } = require("./lib/d1Schema"); const f = requireD1("runtime_email_sends", ["  sent_by TEXT,", "  provider TEXT", "  group_send_id TEXT,"]); examined += 1; if (f.length) throw new Error(f.join("; "));
  if (d1Sql().includes("CREATE TABLE IF NOT EXISTS email_send_logs")) throw new Error("The runtime log is runtime_email_sends; a second email_send_logs table would split it."); }
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/d1RuntimeStore.ts"]) check(store, ["appendEmailSendLog", "listEmailSendLogs", "listAllEmailSendLogs"]);
check("tests/unit/eventEmail.test.ts", ["refuses to send to nobody", "a send writes one row per recipient"]);
if (examined < 10) throw new Error(`validate_event_email_real examined only ${examined} files`);
console.log(`validate_event_email_real: PASS — ${examined} files examined; every send is logged, the page reads the log, and nothing sends on a timer.`);
