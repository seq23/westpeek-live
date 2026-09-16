const fs = require("fs");
/**
 * Templates are wired, not decorative (16 Sep 2026). They were three compiled fixtures rendered as
 * read-only cards that nothing consumed: /app/events/new never offered one. Now a template is a row
 * in the runtime store (migration 0033), "Use this template" opens the create form already filled
 * in, an event can be saved as a template, and every field a template carries is one the create
 * path actually reads.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

check("db/migrations/0033_event_templates.sql", ["create table if not exists public.runtime_event_templates", "sessions", "registration_questions", "duration_minutes"]);
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) check(store, ["upsertEventTemplate", "listEventTemplates", "getEventTemplate", "deleteEventTemplate"]);
const service = check("services/events/eventTemplateService.ts", ["export async function saveEventTemplate", "export async function templateFromEvent", "export async function listEventTemplates", "Math.max(15, Math.min(480"]);
if (!service.includes("A template needs a name")) throw new Error("A nameless template must be refused in words.");

const library = check("components/events/EventTemplateLibrary.tsx", ["listEventTemplates", "Use this template", "A template is a starting point for an event", "save-event-as-template", "templatePrefillQuery"]);
if (library.includes("getRuntimeData")) throw new Error("The template library must read the store, not the seed fixtures.");
check("app/app/templates/page.tsx", ["EventTemplateLibrary"]);
check("lib/actions/eventTemplateActions.ts", ["saveTemplateAction", "saveEventAsTemplateAction", "deleteTemplateAction", "requireWorkspaceActor"]);

// The create path really consumes a template.
const createPage = check("app/app/events/new/page.tsx", ["getEventTemplate", "create-from-template", 'name="templateId"']);
if (!createPage.includes("template?.format")) throw new Error("The create form must open on the template's format.");
const createAction = check("lib/actions/eventWorkspaceActions.ts", ["getEventTemplate(templateId)", "input.templateSessions = template.sessions", "input.durationMinutes = template.durationMinutes"]);
void createAction;
check("services/events/eventRepository.ts", ["templateSessions?:", "function sessionsFromTemplate", "input.templateSessions?.length"]);
check("tests/unit/eventTemplates.test.ts", ["an event created from a template gets its length and its agenda", "the page reads the store, not the seed fixtures"]);

// And it is off the seed-fixture baseline for good.
const seedValidator = read("scripts/validate_no_seed_data_on_app_pages.js");
examined += 1;
if (seedValidator.includes('"app/app/templates/page.tsx"')) throw new Error("Templates must be off the KNOWN_SEED_PAGES list now that it reads the store.");
if (examined < 10) throw new Error(`validate_event_templates_real examined only ${examined} files`);
console.log(`validate_event_templates_real: PASS — ${examined} files examined; templates are rows the create form reads, and the seed fixtures are gone from the page.`);
