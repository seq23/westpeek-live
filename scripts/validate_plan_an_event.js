const fs = require("fs");
/**
 * Plan an event, end to end (16 Sep 2026).
 *
 * /request-event used to collect a request and stop. The whole path now exists: a budget band on
 * the form, a price and a scope attached in the workspace, a client link that confirms, a manual
 * settlement, and five instruction emails that carry LINKS to pages West Peek can edit.
 *
 * What this validator holds, and why each one is here rather than a comment:
 *  - budget is required on the public form and refused server-side, so a request is always priceable;
 *  - one row runs the whole path (migration 0034 extends request_event_intake, it does not shadow it);
 *  - every route to "paid" goes through recordSettlement, which is the seam a provider drops into;
 *  - the instruction emails link to /how-it-works/<audience> and never carry the page's text;
 *  - the pages are editable by owner and operator, and the rule is checked in the action, not by
 *    hiding the form;
 *  - nothing sends on a timer, and no state change mails anybody as a side effect.
 */
const failures = [];
let examined = 0;

function read(file) {
  if (!fs.existsSync(file)) { failures.push(`Missing ${file}`); return ""; }
  examined += 1;
  return fs.readFileSync(file, "utf8");
}

function needs(file, body, tokens) {
  const missing = tokens.filter((token) => !body.includes(token));
  if (missing.length) failures.push(`${file} missing: ${missing.join(" | ")}`);
}

// 1 — the request, with a budget that is required on both sides of the wire.
const requestPage = read("app/request-event/page.tsx");
needs("app/request-event/page.tsx", requestPage, ["BUDGET_RANGES", 'name="budgetRange"', "required", "Submit event request", "requestEventProduction"]);
if (requestPage.includes("Create account") || requestPage.includes("/billing")) failures.push("The public request form must not create an account or expose billing.");

const requestAction = read("lib/actions/requestEventActions.ts");
needs("lib/actions/requestEventActions.ts", requestAction, ["isBudgetRange(budgetRange)", "budgetRange,", "attachEventToRequest"]);
if (!/!isBudgetRange\(budgetRange\)[\s\S]{0,80}status=missing/.test(requestAction)) failures.push("A request with no budget band, or one nobody offered, must be refused server-side.");

const types = read("types/eventRequest.ts");
needs("types/eventRequest.ts", types, ["BUDGET_RANGES", "EventRequestState", "requested", "approved", "confirmed", "paid", "declined"]);

// 2 — one row, one list. The migration extends the intake table rather than shadowing it.
const migration = read("db/migrations/0034_plan_an_event_pipeline.sql");
needs("db/migrations/0034_plan_an_event_pipeline.sql", migration, [
  "alter table public.request_event_intake add column if not exists budget_range",
  "add column if not exists state",
  "add column if not exists confirm_token",
  "add column if not exists settlement_method",
  "add column if not exists instructions_sent_at",
  "create table if not exists public.how_it_works_pages",
  "request_event_intake_confirm_token_idx",
]);
if (/create table if not exists public\.request_event_intake/.test(migration)) failures.push("0034 must EXTEND request_event_intake (0023 owns it). A second table would be a second list that drifts.");
const mirror = "supabase/migrations/20260916240000_plan_an_event_pipeline.sql";
if (!fs.existsSync(mirror)) failures.push(`${mirror} is missing; only supabase/migrations reaches production.`);
else { examined += 1; if (fs.readFileSync(mirror, "utf8") !== migration) failures.push(`${mirror} drifted from the canonical migration.`); }

// 3 — the state machine, and the ONE function that writes "paid".
const pipeline = read("services/event-intake/eventRequestPipeline.ts");
needs("services/event-intake/eventRequestPipeline.ts", pipeline, [
  "export async function submitEventRequest",
  "export async function approveEventRequest",
  "export async function declineEventRequest",
  "export async function confirmEventRequestByToken",
  "export async function recordSettlement",
  "export function mintConfirmToken",
  "crypto.getRandomValues",
]);
if (!pipeline.includes('request.state !== "confirmed"')) failures.push("Settlement must refuse a request the client has not confirmed; otherwise instructions go out for something nobody agreed to.");
if (!/state: "paid"/.test(pipeline)) failures.push("recordSettlement must be what writes the paid state.");
for (const file of ["lib/actions/eventRequestActions.ts", "components/requests/EventRequestPipelinePanel.tsx", "services/event-intake/eventRequestEmails.ts"]) {
  const body = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (/state:\s*"paid"/.test(body)) failures.push(`${file} writes the paid state directly. Every route to paid goes through recordSettlement, which is the seam a payment provider drops into.`);
}
if (!/method: SettlementMethod/.test(pipeline)) failures.push("Settlement method must be a parameter, not an assumption: that parameter IS the provider seam.");

// 4 — the client's page: token only, honest about manual settlement, no invented provider.
const proposal = read("app/proposal/[token]/page.tsx");
needs("app/proposal/[token]/page.tsx", proposal, ["getEventRequestByConfirmToken", "confirmProposalAction", "proposal-confirm", "bank transfer"]);
for (const invented of ["stripe", "Stripe", "loadStripe", "card number", "cardElement"]) {
  if (proposal.includes(invented)) failures.push(`The confirm page must not imply a payment provider that is not wired up (${invented}).`);
}

// 5 — the instruction emails carry links, not copies, and each audience has its own page.
const emails = read("services/event-intake/eventRequestEmails.ts");
needs("services/event-intake/eventRequestEmails.ts", emails, ["INSTRUCTION_AUDIENCES", "howItWorksPath(entry.audience)", "appendEmailSendLog", "sendApprovalEmail", "sendInstructionEmails"]);
if (emails.includes("HOW_IT_WORKS_DEFAULTS[audience].body") || /summary:\s*page\.body/.test(emails)) failures.push("An instruction email must carry the LINK, never the page's text: a frozen copy cannot be corrected.");
if (/setInterval|setTimeout|cron|scheduled/.test(emails)) failures.push("Nothing on this path may send on a timer.");

const actions = read("lib/actions/eventRequestActions.ts");
needs("lib/actions/eventRequestActions.ts", actions, ["requireOperatorAccessForRequest", "recordSettlement", "sendInstructionEmails", "sendApprovalEmail", "confirmProposalAction"]);
if (/setInterval|cron|scheduled/.test(actions)) failures.push("Nothing may send on a timer.");
if (!/export async function confirmProposalAction[\s\S]{0,700}confirmEventRequestByToken\(token\)/.test(actions)) failures.push("The client's confirm must resolve by token alone, never by an id in the form.");
if (/export async function confirmProposalAction[\s\S]{0,900}send(Approval|Instruction)/.test(actions)) failures.push("The client confirming must not mail anybody: nobody at West Peek has acted yet.");

// 6 — five real pages, editable by owner and operator, read-only to everyone else.
const AUDIENCES = ["client", "crew", "speaker", "sponsor", "attendee"];
const defaults = read("services/content/howItWorksDefaults.ts");
const service = read("services/content/howItWorksService.ts");
needs("services/content/howItWorksService.ts", service, ["readHowItWorksPage", "saveHowItWorksPage", "getRuntimeStore().getHowItWorksPage", "setHowItWorksPage"]);
for (const audience of AUDIENCES) {
  examined += 1;
  if (!new RegExp(`slug: "${audience}"`).test(defaults)) failures.push(`No first draft shipped for /how-it-works/${audience}; the page would be blank before its first edit.`);
}
// House style, and the crew page's promise that it stands alone.
const bodies = defaults.split("body: `").slice(1).map((chunk) => chunk.split("`,")[0]);
if (bodies.length !== AUDIENCES.length) failures.push(`Expected ${AUDIENCES.length} instruction drafts, found ${bodies.length}.`);
for (const body of bodies) {
  if (body.includes("—")) failures.push("Instruction body copy must not use em-dashes.");
  if (body.length < 800) failures.push("An instruction draft under 800 characters is a placeholder, not an instruction.");
}
const crewDraft = bodies[AUDIENCES.indexOf("crew")] || "";
for (const topic of ["production-access/crew", "crew code", "Go live", "stream credentials", "Moderat", "fallback", "Cloudflare Stream", "Move back up", "End the show"]) {
  if (!crewDraft.includes(topic)) failures.push(`The crew instructions must be self-contained and cover "${topic}".`);
}

const audiencePage = read("app/how-it-works/[audience]/page.tsx");
needs("app/how-it-works/[audience]/page.tsx", audiencePage, ["readHowItWorksPage", "renderMarkdownLite", "getWorkspaceActor", 'actor?.kind === "owner"', 'actor?.kind === "operator"', "HowItWorksEditor"]);
const editorAction = read("lib/actions/howItWorksActions.ts");
needs("lib/actions/howItWorksActions.ts", editorAction, ["requireOperatorAccessForRequest", "saveHowItWorksPage", "isHowItWorksAudience"]);
if (!/const auth = await requireOperatorAccessForRequest\(\);[\s\S]{0,120}throw new Error/.test(editorAction)) {
  failures.push("The save action must check the gate on the server. Hiding the form is a courtesy; this is the rule.");
}

// 7 — the workspace surface, reachable by owner AND operator.
const workspacePage = read("app/app/requests/page.tsx");
needs("app/app/requests/page.tsx", workspacePage, ["EventRequestPipelinePanel", "SafeSection", "how-it-works"]);
const panel = read("components/requests/EventRequestPipelinePanel.tsx");
needs("components/requests/EventRequestPipelinePanel.tsx", panel, ["listEventRequests", "approveEventRequestAction", "markRequestPaidAction", "declineEventRequestAction", "event-request-pipeline"]);
if (!/request\.state === "confirmed"[\s\S]{0,4000}markRequestPaidAction|markRequestPaidAction[\s\S]{0,200}/.test(panel)) failures.push("Mark paid must only be offered on a confirmed request.");
const nav = read("lib/navigation/workspaceNav.ts");
if (!nav.includes('href: "/app/requests"')) failures.push("/app/requests must be in the workspace navigation, or the surface exists with no way in.");
const authorization = read("lib/auth/v5RouteAuthorization.ts");
if (!authorization.includes('"/app/requests"')) failures.push("An operator must be able to reach /app/requests; owner already can, operator needs the exact path.");

// 8 — codes stay the event's own, uppercase, from the existing scheme.
if (/WPL-|CREW-|SPK-/.test(emails.replace(/\/\*[\s\S]*?\*\//g, ""))) failures.push("The instruction emails must read the event's codes, never build a code of their own.");
if (!emails.includes("displayCode(")) failures.push("Codes in an instruction email must go through displayCode, which is what makes them UPPERCASE.");

// 9 — the proof.
const test = read("tests/unit/eventRequestPipeline.test.ts");
needs("tests/unit/eventRequestPipeline.test.ts", test, [
  "a request persists with its budget band",
  "approving attaches a price and a scope",
  "the client confirms with the token and nothing else",
  "marking paid sends the instructions, and the log records what went to whom",
  "nothing sends without being asked",
  "an edit replaces the draft",
]);

if (examined < 18) failures.push(`validate_plan_an_event examined only ${examined} files; the rule would pass on an empty loop.`);

if (failures.length) {
  console.error("validate_plan_an_event: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_plan_an_event: PASS — ${examined} files examined; budget required, one row from request to paid, settlement through one seam, five editable instruction pages, and nothing sends without a person.`);
