const fs = require("fs");
/**
 * Five things the owner found on 16 Sep 2026, and the shape of the fix for each.
 *
 *   1. The template shelf was empty on a clean install, so /app/events/new offered nothing and the
 *      feature read as missing. Four starter templates are installed ONCE as ordinary rows.
 *   2. The Email tab could only send a test. It sends for real now, through the same action the
 *      event page posts to.
 *   3. The Communications page stacked two comms panels writing to two different logs. One panel,
 *      one log; the crew call sheet the old one had came across as an eighth workflow.
 *   4. The manual and the five instruction pages are downloadable as Markdown from Assets, built
 *      from live content, and structurally not assets — no archive, no delete, no event counts.
 *   5. Settings held four fields. Seven house defaults now live on a sibling row, each consumed.
 *
 * Every check below is the negative of something that was actually wrong. A check that examined
 * nothing is a check that proves nothing, so this counts what it read and fails on a short count.
 */
const failures = [];
let examined = 0;

function read(file) {
  if (!fs.existsSync(file)) { failures.push(`Missing ${file}`); return ""; }
  examined += 1;
  return fs.readFileSync(file, "utf8");
}

function requireTokens(file, tokens) {
  const body = read(file);
  if (!body) return "";
  for (const token of tokens) if (!body.includes(token)) failures.push(`${file} must contain ${token}`);
  return body;
}

function refuseTokens(file, tokens, why) {
  const body = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const token of tokens) if (body.includes(token)) failures.push(`${file} still contains ${token}: ${why}`);
}

// ─── 1. The shelf is stocked, once, with ordinary rows ──────────────────────────────────────────
const starters = requireTokens("services/events/starterEventTemplates.ts", [
  "template-starter-west-peek-room",
  "template-starter-45-minute-workshop",
  "template-starter-client-webinar",
  "template-starter-demo-day",
  "starterTemplateLengthMismatches",
]);
// Four, and no more: a fifth nobody asked for is the decoration this replaced.
const starterIds = (starters.match(/id: "template-starter-[a-z0-9-]+"/g) || []).length;
if (starterIds !== 4) failures.push(`starterEventTemplates.ts declares ${starterIds} starters; there are meant to be four.`);

requireTokens("services/events/eventTemplateService.ts", [
  "export async function installStarterTemplatesOnce",
  "house.starterTemplatesInstalledAt",
  "markStarterTemplatesInstalled",
  "await installStarterTemplatesOnce()",
]);
// The install is marked, so a deleted starter stays deleted.
const templateService = fs.readFileSync("services/events/eventTemplateService.ts", "utf8");
if (!/if \(house\.starterTemplatesInstalledAt\) return/.test(templateService)) failures.push("The starter install must return early once it has been marked, or the starters grow back after a delete.");

// And they are not a seed fixture: the seed-page validator must not have been taught to allow them.
const seedValidator = read("scripts/validate_no_seed_data_on_app_pages.js");
for (const token of ["starterEventTemplates", "template-starter"]) {
  if (seedValidator.includes(token)) failures.push(`scripts/validate_no_seed_data_on_app_pages.js exempts ${token}: the starters are ordinary rows and must never be on an exemption list.`);
}

// The picker is on the create form, above the Now/Later choice, and says so when it is empty.
const picker = requireTokens("components/events/NewEventTemplatePicker.tsx", [
  "listEventTemplates",
  "new-event-template-picker",
  "new-event-template-empty-link",
  "Start from a template",
]);
if (!picker.includes('data-count={templates.length}')) failures.push("The picker must expose how many templates it found.");
const createPage = requireTokens("app/app/events/new/page.tsx", [
  "NewEventTemplatePicker",
  "openingQuestions",
  "house.defaultTimezone",
  "getEventTemplate",
]);
const pickerAt = createPage.indexOf("<NewEventTemplatePicker");
const whenAt = createPage.indexOf('data-testid="when-now"');
if (pickerAt < 0 || whenAt < 0 || pickerAt > whenAt) failures.push("The template picker must render before the Now/Later choice: picking one changes what the rest of the form holds.");
if (!createPage.includes("template?.registrationQuestions.length")) failures.push("The create form must open on the template's registration questions, not the code defaults.");
requireTokens("lib/actions/eventWorkspaceActions.ts", ["getEventTemplate(templateId)", "input.templateSessions = template.sessions", "input.durationMinutes = template.durationMinutes"]);

// ─── 2. The Email tab sends for real, and does not fork the send path ───────────────────────────
const crossEvent = requireTokens("components/email/CrossEventSendPanel.tsx", [
  "sendEventEmailAction",
  "MANUAL_WORKFLOWS",
  "cross-event-send-form",
  "cross-event-send-submit",
  'name="returnTo"',
]);
for (const token of ["sendManualWorkflow", "appendEmailSendLog", "createEmailProvider"]) {
  if (crossEvent.includes(token)) failures.push(`CrossEventSendPanel uses ${token} directly: the Email tab must post to the same action the event page posts to, not carry its own send path.`);
}
requireTokens("lib/actions/eventEmailActions.ts", ['clean(formData.get("returnTo")) === "/app/email"', "redirect(`${returnTo}?${query}`)"]);
const emailPage = requireTokens("app/app/email/page.tsx", ["CrossEventSendPanel", "EmailAcrossEvents", "TestEmailPanel"]);
if (emailPage.indexOf("CrossEventSendPanel") > emailPage.indexOf("<TestEmailPanel")) failures.push("The real sender must come before the test sender on /app/email.");
// The test is demoted, and honest about what it is not.
const testPanel = requireTokens("components/email/TestEmailPanel.tsx", ["<details", "deliverability", "test-email-panel"]);
if (testPanel.includes("Send a Resend test email") || testPanel.includes("Safe test send")) failures.push("The test sender is still presented as the page's headline action.");

// ─── 3. One comms panel, one log, eight workflows ───────────────────────────────────────────────
for (const gone of [
  "components/communications/EventCommunicationsDashboard.tsx",
  "components/communications/EmailSendLog.tsx",
  "components/communications/EmailTemplateList.tsx",
  "components/communications/RecipientSegmentPanel.tsx",
  "lib/actions/communicationActions.ts",
  "services/communications/eventCommunicationService.ts",
  "services/communications/emailSendLogService.ts",
  "services/communications/emailTemplateRenderer.ts",
]) {
  if (fs.existsSync(gone)) failures.push(`${gone} still exists: the superseded communications panel and its chain were deleted.`);
  examined += 1;
}
const commsPage = requireTokens("app/app/events/[eventId]/communications/page.tsx", ["EventEmailCenter"]);
refuseTokens("app/app/events/[eventId]/communications/page.tsx", ["EventCommunicationsDashboard"], "two send logs on one page is how you send the same email twice.");
const commsPanels = (commsPage.match(/render=\{\(\) =>/g) || []).length;
if (commsPanels !== 1) failures.push(`The communications page renders ${commsPanels} panels; it renders exactly one.`);
// The crew call sheet survived the deletion.
requireTokens("types/emailWorkflows.ts", ['"crew_call_sheet"']);
requireTokens("services/email/emailWorkflowTemplates.ts", ["crew_call_sheet:"]);
const manual = requireTokens("services/email/eventEmailService.ts", ['workflow: "crew_call_sheet"']);
const workflowCount = (manual.match(/\{ workflow: "/g) || []).length;
if (workflowCount !== 8) failures.push(`MANUAL_WORKFLOWS has ${workflowCount} entries; the seven plus the crew call sheet is eight.`);

// ─── 4. Documents in Assets: live, downloadable, and structurally not assets ────────────────────
const documents = requireTokens("services/documents/westPeekDocuments.ts", [
  "operator-manual",
  "HOW_IT_WORKS_AUDIENCES",
  "readHowItWorksPage",
  "MANUAL_SOURCE",
  "findAccessCodeShape(MANUAL_SOURCE)",
]);
// Imports, not prose: the module explains the separation in its comment, so a substring check on
// the whole file would trip on the explanation instead of on a real coupling.
const documentImports = (documents.match(/^import .*$/gm) || []).join("\n");
for (const token of ["services/assets", "types/eventAssets", "eventAssetService"]) {
  if (documentImports.includes(token)) failures.push(`westPeekDocuments.ts imports ${token}: documents are not assets, and that separation is what keeps them out of an event's counts.`);
}
requireTokens("app/api/documents/[documentId]/download/route.ts", ["renderWestPeekDocument", "text/markdown", "attachment; filename=", "getWorkspaceActor"]);
const documentsPanel = requireTokens("components/assets/WestPeekDocuments.tsx", ["west-peek-documents", "document-download-", "documentDownloadPath"]);
for (const token of ["archiveAssetAction", "asset-archive-", "setAssetVisibilityAction", "reviewAssetAction"]) {
  if (documentsPanel.includes(token)) failures.push(`The documents group offers ${token}: a document cannot be archived or reviewed through the asset actions.`);
}
requireTokens("app/app/assets/page.tsx", ["WestPeekDocuments", "AssetsAcrossEvents"]);
// The manual download runs the same access-code check the manual validator runs, from one list.
requireTokens("lib/manual/accessCodeShapes.ts", ["ACCESS_CODE_SHAPES", "ACCESS_CODE_PLACEHOLDERS", "PASSWORD_SHAPE", "export function findAccessCodeShape"]);
const manualValidator = requireTokens("scripts/validate_manual_in_app.js", ["lib/manual/accessCodeShapes.ts", "did not yield the code shapes"]);
if (/const CODE_SHAPES = \[\//.test(manualValidator)) failures.push("validate_manual_in_app.js keeps its own copy of the code shapes again: one list, or the download and the validator drift.");

// ─── 5. House defaults, each one consumed ───────────────────────────────────────────────────────
requireTokens("types/houseDefaults.ts", ["HOUSE_DEFAULTS_ID", "starterTemplatesInstalledAt", "isSendableAddress"]);
requireTokens("db/migrations/0043_house_defaults.sql", ["create table if not exists public.runtime_house_defaults", "default_registration_questions", "livekit_tier", "starter_templates_installed_at"]);
const mirror = "supabase/migrations/20260917110000_house_defaults.sql";
examined += 1;
if (!fs.existsSync(mirror) || fs.readFileSync(mirror, "utf8") !== fs.readFileSync("db/migrations/0043_house_defaults.sql", "utf8")) failures.push(`${mirror} must be a byte-identical mirror of db/migrations/0043_house_defaults.sql`);
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) requireTokens(store, ["getHouseDefaults", "setHouseDefaults"]);
requireTokens("services/agencies/houseDefaultsService.ts", ["houseDefaultsFloor", "saveHouseDefaults", "houseLivekitTier", "setHouseLogo", "markStarterTemplatesInstalled"]);
requireTokens("components/settings/HouseDefaultsPanel.tsx", ["house-from-email", "house-reply-to", "house-timezone", "house-livekit-tier", "house-networking-minutes", "house-session-days", "house-registration-questions", "verified"]);
requireTokens("components/settings/HouseLogoUploader.tsx", ["requestHouseLogoUploadAction", "signedUrl", "confirmHouseLogoUploadAction"]);
requireTokens("app/app/settings/page.tsx", ["HouseDefaultsPanel", "/app/capacity"]);
refuseTokens("app/app/settings/page.tsx", ["Billing is not configured in this baseline"], "billing is real now: LiveKit Ship, Workers Paid, Cloudflare Stream.");
// Nothing secret on an operator-reachable page.
const settingsPage = fs.readFileSync("app/app/settings/page.tsx", "utf8") + fs.readFileSync("components/settings/HouseDefaultsPanel.tsx", "utf8");
for (const token of ["accessCode", "masterPassword", "OWNER_MASTER", "joinCode"]) {
  if (settingsPage.includes(token)) failures.push(`Settings renders ${token}: codes and master passwords belong in the owner-only vault, not on an operator-reachable page.`);
}
// Each default reaches the thing it governs.
const consumers = [
  // The exact expression, not the token: a mention of house.defaultTimezone somewhere else in the
  // file is not the same as the event record being stamped with it (the negative proof caught this).
  ["services/events/eventRepository.ts", "timezone: input.timezone?.trim() || house.defaultTimezone", "the timezone a new event opens on"],
  ["services/events/eventRepository.ts", ": input.registrationQuestions?.length ? input.registrationQuestions : house.defaultRegistrationQuestions", "the questions a new event starts with"],
  ["services/events/eventRepository.ts", "attendeeSessionDays: house.defaultAttendeeSessionDays", "how long an attendee stays registered"],
  ["services/events/eventRepository.ts", "matchMinutes: house.defaultNetworkingMatchMinutes", "the networking match length a new event inherits"],
  ["services/email/emailService.ts", "provider.send(await withHouseAddresses(message))", "the from and reply-to on every message"],
  ["services/email/productionEmailService.ts", "provider.send(await withHouseAddresses({", "the from and reply-to on a workflow send"],
  ["services/capacity/capacityReadingService.ts", "livekitPlan(await houseLivekitTier())", "the plan the capacity readout measures against"],
  ["components/brand/HouseLogo.tsx", "await houseLogoUrl(house.logoStoragePath)", "the logo that replaces the wordmark"],
];
for (const [file, token, why] of consumers) {
  const body = read(file);
  if (body && !body.includes(token)) failures.push(`${file} does not read ${token}: the setting for ${why} would save and change nothing.`);
}

// The tests that prove the behaviour, not just the wiring.
requireTokens("tests/unit/shelfEmailAssetsAndHouseDefaults.test.ts", [
  "the starter templates install once and a deleted one stays deleted",
  "a changed house default reaches a newly created event",
  "an instruction page download is built from the live content",
]);

if (examined < 35) failures.push(`validate_shelf_email_assets_and_house_defaults examined only ${examined} files; it is meant to read the whole surface.`);

if (failures.length) {
  console.error("validate_shelf_email_assets_and_house_defaults: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_shelf_email_assets_and_house_defaults: PASS — ${examined} files examined; the shelf ships stocked, the Email tab sends, one comms panel owns one log, the documents download live, and every house default is consumed.`);
