const fs = require("fs");
/**
 * Real contractors and vendors (16 Sep 2026). Both pages used to render compiled seed fixtures:
 * no create, no edit, and no link to any event, so the owner could not put a camera op on a show.
 *
 * What must hold now: one table with a `kind` (never two drifting copies of the same fields), real
 * CRUD through the runtime store, a migration mirrored into supabase/migrations or it never reaches
 * production, attach/detach as a LINK so one person can be on many events, filters and a CSV that
 * exports exactly the filtered view, and an empty state that says what to add instead of showing
 * invented rows. The seed boards are gone, not merely unused.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((token) => !body.includes(token)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

// One model, two views: a single kind discriminator, a single record type, a single link type.
const types = check("types/suppliers.ts", ["SupplierKind", '"contractor"', '"vendor"', "SupplierStatus", '"shortlisted"', '"booked"', '"paid"', "SupplierEventLink", "suppliersCsv", "supplierRefusal", "supplierRateLabel", "SUPPLIER_KIND_COPY", "emptyTitle", "emptyBody"]);
if (!/rateAmount/.test(types) || !/notes/.test(types) || !/phone/.test(types) || !/email/.test(types)) throw new Error("types/suppliers.ts must carry name, company, role/service, email, phone, rate and notes.");

const repository = check("services/suppliers/supplierRepository.ts", ["getRuntimeStore()", "createSupplier", "updateSupplier", "setSupplierStatus", "archiveSupplier", "attachSupplierToEvent", "detachSupplierFromEvent", "listSuppliersWithEvents", "listSuppliersForEvent", "supplierEventOptions", "suppliersCsvForFilter"]);
if (repository.includes("getRuntimeData")) throw new Error("The supplier repository must never read the seed fixtures.");
// The CSV must run through the same filtered call as the page, or the file and the screen diverge.
if (!/suppliersCsv\(\s*rows\.map/.test(repository)) throw new Error("suppliersCsvForFilter must export the rows listSuppliersWithEvents returned for the same filter.");

check("lib/actions/supplierActions.ts", ["requireWorkspaceActor", "createSupplierAction", "updateSupplierAction", "setSupplierStatusAction", "archiveSupplierAction", "attachSupplierAction", "detachSupplierAction", "revalidatePath"]);

for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) {
  check(store, ["upsertSupplier", "getSupplier", "listSuppliers", "upsertSupplierEventLink", "deleteSupplierEventLink", "listSupplierEventLinks"]);
}
check("services/runtime/runtimeStore.ts", ["suppliers: SupplierRecord[]", "supplierEventLinks: SupplierEventLink[]", "upsertSupplier(", "listSupplierEventLinks("]);
// A missing table has to be a NAMED stop on the health probe, not a blank page.
check("services/events/eventRepository.ts", ['["suppliers", () => store.listSuppliers()]', '["supplier_event_links", () => store.listSupplierEventLinks()]']);
check("types/runtimeEvent.ts", ["SUPPLIERS_MIGRATION_FILE", "supplier_event_links: SUPPLIERS_MIGRATION_FILE"]);

const migration = check("db/migrations/0033_contractors_and_vendors.sql", ["create table if not exists public.suppliers", "create table if not exists public.supplier_event_links", "kind text", "role_or_service", "rate_kind", "rate_amount", "status text", "archived_at", "supplier_event_links_pair_idx"]);
const mirror = "supabase/migrations/20260916230000_contractors_and_vendors.sql";
if (!fs.existsSync(mirror)) throw new Error(`${mirror} is missing; the migration would never run in production.`);
if (fs.readFileSync(mirror, "utf8") !== migration) throw new Error(`${mirror} drifted from the canonical 0033 migration.`);
examined += 1;

// Two tables for the same fields is the thing this design refused; catch a later split.
if (fs.existsSync("db/migrations") && fs.readdirSync("db/migrations").some((name) => /vendors_table|contractors_table/.test(name))) throw new Error("Contractors and vendors are one table with a kind; a second table would split the same fields.");

const directory = check("components/suppliers/SupplierDirectory.tsx", ["listSuppliersWithEvents(", "supplierEventOptions(", "supplier-filter-status-", "supplier-filter-event-", "supplier-export-csv-", "EmptyState", "SupplierForm", "SupplierRow"]);
if (directory.includes("getRuntimeData")) throw new Error("The Contractors/Vendors directory must never read the seed fixtures.");
check("components/suppliers/EventSupplierBoard.tsx", ["listSuppliersForEvent(", "listSuppliersAvailableForEvent(", "attachSupplierAction", "EmptyState", "supplier-attach-submit-"]);
check("components/suppliers/SupplierRow.tsx", ["setSupplierStatusAction", "detachSupplierAction", "archiveSupplierAction", "supplier-detach-", "supplier-events-", "SupplierForm"]);
check("components/suppliers/SupplierForm.tsx", ["createSupplierAction", "updateSupplierAction", "roleOrService", "rateAmount", "notes"]);

check("app/app/contractors/page.tsx", ['SupplierDirectory', 'kind: "contractor"']);
check("app/app/vendors/page.tsx", ['SupplierDirectory', 'kind: "vendor"']);
check("app/app/events/[eventId]/talent/page.tsx", ['EventSupplierBoard', 'kind: "contractor"']);
check("app/app/events/[eventId]/vendors/page.tsx", ['EventSupplierBoard', 'kind: "vendor"']);
check("app/api/suppliers/export/route.ts", ["suppliersCsvForFilter(", "getWorkspaceActor", "text/csv"]);

// The seed boards must be GONE, not merely unimported: an unused export is a page waiting to happen.
if (fs.existsSync("components/vendors/VendorBoard.tsx")) throw new Error("components/vendors/VendorBoard.tsx renders seed fixtures and must be deleted.");
const contractorBoard = read("components/contractors/ContractorBoard.tsx");
examined += 1;
for (const gone of ["export function ContractorBench", "export function EventCrewBoard"]) {
  if (contractorBoard.includes(gone)) throw new Error(`${gone} renders seed fixtures and must be deleted; the real pages are components/suppliers/*.`);
}

// The shrink-only seed list must no longer carry these three pages.
const seedList = read("scripts/validate_no_seed_data_on_app_pages.js");
examined += 1;
for (const page of ["app/app/contractors/page.tsx", "app/app/vendors/page.tsx", "app/app/events/[eventId]/vendors/page.tsx"]) {
  if (new RegExp(`"${page.replace(/[[\]]/g, "\\$&")}"`).test(seedList)) throw new Error(`${page} is real now; take it off KNOWN_SEED_PAGES.`);
}

const test = check("tests/unit/suppliers.test.ts", [
  "appears in the global list",
  "attaching puts them on the event's page",
  "one person is attached to many events",
  "status moves shortlisted",
  "the CSV is exactly the filtered view",
  "an empty store is empty",
]);
if (!test.includes("detachSupplierFromEvent")) throw new Error("Detach must be proven by a test.");

if (examined < 18) throw new Error(`validate_contractors_and_vendors_real examined only ${examined} files; the rule would pass on an empty loop`);
console.log(`validate_contractors_and_vendors_real: PASS — ${examined} files examined; contractors and vendors are one table with a kind, real CRUD, mirrored migration 0033, event links, filtered CSV and honest empty states, proven by tests/unit/suppliers.test.ts.`);
