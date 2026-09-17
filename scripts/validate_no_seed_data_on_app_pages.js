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
/**
 * Demo-only surfaces may read the seed fixtures; they say "demo" on the page. Every *SeedView is
 * the seed branch of a workspace page: its dispatcher asks realRuntimeEvent(eventId) first and only
 * a seed event ever reaches it, which is the owner's rule — seed data is fine if it is for a test
 * or a demo. Each one must carry the @seed-view marker, checked below, so the exemption cannot be
 * claimed by a file that quietly stopped being a demo branch.
 */
const ALLOWED = new Set([
  // components/production/DemoEventPreview.tsx was here until 16 Sep 2026; no such file has ever
  // existed on this branch, so the exemption was protecting nothing. The existence check below
  // now catches that class of entry.
  "components/approvals/EventApprovalQueueSeedView.tsx",
  "components/events/EventOverviewSeedView.tsx",
  "components/production/ProductionCommandCenterSeedView.tsx",
  "components/run-of-show/RunOfShowSeedView.tsx",
  "components/speakers/SpeakerManagerSeedView.tsx",
  "components/sponsors/SponsorManagerSeedView.tsx",
  "components/tasks/TaskBoardSeedView.tsx",
]);

/**
 * EMPTY as of 16 Sep 2026, and it stays that way. Eleven event-workspace pages stood here — the
 * owner opened an event she had created and was shown the demo summit's speakers, sponsors, tasks,
 * run of show and an 87% readiness score computed off fixtures. Each one now reads the runtime
 * store and renders an honest empty state where there is nothing yet.
 *
 * This list may only SHRINK: a new offender fails, and an entry that no longer offends must be
 * deleted. Nothing may be added back without the owner saying so in the PR that adds it.
 */
const KNOWN_SEED_PAGES = new Set([]);

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
for (const allowed of ALLOWED) {
  if (!fs.existsSync(allowed)) { failures.push(`${allowed} is on the ALLOWED list but does not exist: delete the entry`); continue; }
  if (!/SeedView\.tsx$/.test(allowed)) continue;
  if (!readFile(allowed).includes("@seed-view")) failures.push(`${allowed} claims the demo exemption but carries no @seed-view marker explaining which dispatcher guards it`);
}
if (!examined) failures.push("validate_no_seed_data_on_app_pages examined zero files");
if (!componentIndex.size) failures.push("validate_no_seed_data_on_app_pages examined zero components");
if (failures.length) {
  console.error("validate_no_seed_data_on_app_pages: FAIL — seed fixtures must never be shown as the owner's real data");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_no_seed_data_on_app_pages: PASS — ${examined} /app files and ${componentIndex.size} components examined; ${offenders.size} on seed fixtures; KNOWN_SEED_PAGES holds ${KNOWN_SEED_PAGES.size}.`);
