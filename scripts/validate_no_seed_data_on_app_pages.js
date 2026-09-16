const fs = require("fs");
const path = require("path");
/**
 * Nothing under /app may present SEED fixtures as the owner's real data. The Assets page did
 * exactly that until 16 Sep 2026: it rendered getAssetsForEvent() from lib/runtime/getRuntimeData
 * (compiled demo JSON) as if those files existed. Real rows, or an honest empty state.
 *
 * The rule: no page or component reachable from app/app/** may read the seed data module, unless
 * the route is explicitly about the demo (none are today). Components are followed one level: a
 * page that renders a component which reads seed data is the same defect.
 */
const SEED_READS = ["@/lib/runtime/getRuntimeData", "lib/runtime/getRuntimeData", "getAssetsForEvent(", "getRuntimeData()"];
const ALLOWED = new Set([
  // Demo-only surfaces may read the seed fixtures; they say "demo" on the page.
  "components/production/DemoEventPreview.tsx",
]);

/**
 * The pages still standing on seed fixtures on 16 Sep 2026, each waiting for its own rebuild. This
 * list may only SHRINK: a new offender fails, and an entry that no longer offends must be deleted
 * (so the list cannot quietly outlive the defect). Assets was the first one taken off it.
 */
const KNOWN_SEED_PAGES = new Set([
  "app/app/contractors/page.tsx",            // Contractors + Vendors rebuild
  "app/app/vendors/page.tsx",                // Contractors + Vendors rebuild
  "app/app/templates/page.tsx",              // Templates rebuild
  "app/app/events/[eventId]/vendors/page.tsx",
  "app/app/events/[eventId]/analytics/page.tsx",
  "app/app/events/[eventId]/report/page.tsx",
  "app/app/events/[eventId]/approval-queue/page.tsx",
  "app/app/events/[eventId]/builder/page.tsx",
  "app/app/events/[eventId]/overview/page.tsx",
  "app/app/events/[eventId]/page.tsx",
  "app/app/events/[eventId]/publish/page.tsx",
  "app/app/events/[eventId]/run-of-show/page.tsx",
  "app/app/events/[eventId]/speakers/page.tsx",
  "app/app/events/[eventId]/sponsors/page.tsx",
  "app/app/events/[eventId]/tasks/page.tsx",
]);

function readFile(file) { return fs.readFileSync(file, "utf8"); }
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const appFiles = walk("app/app");
const componentFiles = walk("components");
const componentIndex = new Map(componentFiles.map((file) => [file, readFile(file)]));

function readsSeed(body) {
  return SEED_READS.some((token) => body.includes(token));
}

// Which components read seed data?
const seedComponents = new Set();
for (const [file, body] of componentIndex) {
  if (ALLOWED.has(file)) continue;
  if (readsSeed(body)) seedComponents.add(file);
}

const failures = [];
const offenders = new Set();
let examined = 0;
for (const file of appFiles) {
  const body = readFile(file);
  examined += 1;
  if (readsSeed(body)) offenders.add(file);
  for (const match of body.matchAll(/from "@\/components\/([^"]+)"/g)) {
    for (const candidate of [`components/${match[1]}.tsx`, `components/${match[1]}.ts`]) {
      if (seedComponents.has(candidate)) offenders.add(file);
    }
  }
}
for (const file of offenders) {
  if (!KNOWN_SEED_PAGES.has(file)) failures.push(`${file} shows seed fixtures as real data — read the runtime store, or show an honest empty state`);
}
for (const known of KNOWN_SEED_PAGES) {
  if (!offenders.has(known)) failures.push(`${known} no longer reads seed fixtures: delete it from KNOWN_SEED_PAGES so the list keeps shrinking`);
}
if (!examined) failures.push("validate_no_seed_data_on_app_pages examined zero files");
if (failures.length) {
  console.error("validate_no_seed_data_on_app_pages: FAIL — seed fixtures must never be shown as the owner's real data");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_no_seed_data_on_app_pages: PASS — ${examined} /app files examined; ${offenders.size} still on seed fixtures, all of them on the shrinking KNOWN_SEED_PAGES list (${KNOWN_SEED_PAGES.size} left).`);
