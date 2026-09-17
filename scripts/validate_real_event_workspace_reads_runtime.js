const fs = require("fs");

/**
 * The eleven event-workspace pages must read the RUNTIME store for a real event, and a seed event
 * must keep its fixtures. validate_no_seed_data_on_app_pages proves the first half — that no page
 * reaches the seed module. This one proves the second half, which a token scan cannot see:
 *
 *   1. each page still renders its named component,
 *   2. that component asks realRuntimeEvent(eventId) (or resolves the event through the repository,
 *      which serves runtime rows and seed rows alike) before it renders anything,
 *   3. it offers an honest empty state rather than an empty grid,
 *   4. every *SeedView is reached from exactly one dispatcher, and only behind that test, so the
 *      demo exemption cannot be claimed by a component a real event can reach.
 *
 * Without 4, moving a fixture render one file down would satisfy the token scan and change nothing
 * the owner sees. That is the defect class this file exists for.
 */
const REAL_EVENT_TEST = "realRuntimeEvent(";
const REPOSITORY_READ = "findEventRecord(";
const EMPTY_STATE = ["WorkspaceEmptyState", "WorkspaceReadinessList"];

/** page → the component it renders → how that component is allowed to resolve the event. */
const SURFACES = [
  { page: "app/app/events/[eventId]/page.tsx", component: "components/production/ProductionCommandCenter.tsx", seedView: "components/production/ProductionCommandCenterSeedView.tsx" },
  { page: "app/app/events/[eventId]/overview/page.tsx", component: "components/events/EventOverview.tsx", seedView: "components/events/EventOverviewSeedView.tsx" },
  { page: "app/app/events/[eventId]/builder/page.tsx", component: "components/events/EventOverview.tsx", seedView: "components/events/EventOverviewSeedView.tsx" },
  { page: "app/app/events/[eventId]/speakers/page.tsx", component: "components/speakers/SpeakerManager.tsx", seedView: "components/speakers/SpeakerManagerSeedView.tsx" },
  { page: "app/app/events/[eventId]/sponsors/page.tsx", component: "components/sponsors/SponsorManager.tsx", seedView: "components/sponsors/SponsorManagerSeedView.tsx" },
  { page: "app/app/events/[eventId]/tasks/page.tsx", component: "components/tasks/TaskBoard.tsx", seedView: "components/tasks/TaskBoardSeedView.tsx" },
  { page: "app/app/events/[eventId]/run-of-show/page.tsx", component: "components/run-of-show/RunOfShowPage.tsx", seedView: "components/run-of-show/RunOfShowSeedView.tsx" },
  { page: "app/app/events/[eventId]/approval-queue/page.tsx", component: "components/approvals/EventApprovalQueue.tsx", seedView: "components/approvals/EventApprovalQueueSeedView.tsx" },
  { page: "app/app/events/[eventId]/publish/page.tsx", component: "components/events/EventPublishPanel.tsx", seedView: null },
  // Analytics and the client report have always counted the runtime store; they resolve the event's
  // name through the repository, so they need no seed branch at all.
  { page: "app/app/events/[eventId]/analytics/page.tsx", component: "components/analytics/EventAnalyticsDashboard.tsx", seedView: null },
  { page: "app/app/events/[eventId]/report/page.tsx", component: "components/analytics/EventAnalyticsDashboard.tsx", seedView: null },
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
}

const failures = [];
let examined = 0;

for (const surface of SURFACES) {
  const page = read(surface.page);
  const component = read(surface.component);
  if (!page) { failures.push(`${surface.page} is missing`); continue; }
  if (!component) { failures.push(`${surface.component} is missing`); continue; }
  examined += 1;

  const componentName = surface.component.split("/").pop().replace(/\.tsx$/, "");
  if (!page.includes(componentName)) failures.push(`${surface.page} no longer renders ${componentName}: this surface is not covered any more`);

  const resolvesEvent = component.includes(REAL_EVENT_TEST) || component.includes(REPOSITORY_READ);
  if (!resolvesEvent) failures.push(`${surface.component} resolves the event through neither realRuntimeEvent() nor findEventRecord(): a real event cannot be told apart from the demo`);

  if (!EMPTY_STATE.some((token) => component.includes(token))) {
    failures.push(`${surface.component} renders no WorkspaceEmptyState/WorkspaceReadinessList: an event with nothing in it would show an empty grid, which reads as broken`);
  }

  if (surface.seedView) {
    const seedName = surface.seedView.split("/").pop().replace(/\.tsx$/, "");
    if (!read(surface.seedView)) { failures.push(`${surface.seedView} is missing`); continue; }
    if (!component.includes(seedName)) failures.push(`${surface.component} no longer renders ${seedName}: the demo event has lost its fixtures, which is the other half of the rule`);
    // The seed view must be guarded: the dispatcher returns it on the NOT-a-real-event branch.
    if (!/if \(!event\) return <\w*SeedView/.test(component)) {
      failures.push(`${surface.component} does not return ${seedName} behind an "if (!event)" real-event test: a real event could reach the fixtures`);
    }
  }
}

// Nothing outside its own dispatcher may render a *SeedView.
const seedViews = SURFACES.map((surface) => surface.seedView).filter(Boolean);
for (const seedView of new Set(seedViews)) {
  const seedName = seedView.split("/").pop().replace(/\.tsx$/, "");
  const owners = SURFACES.filter((surface) => surface.seedView === seedView).map((surface) => surface.component);
  const importers = [];
  for (const dir of ["app", "components", "lib", "services"]) walk(dir, importers);
  for (const file of importers) {
    if (file === seedView || owners.includes(file)) continue;
    if (new RegExp(`\\b${seedName}\\b`).test(fs.readFileSync(file, "utf8"))) failures.push(`${file} references ${seedName}: a seed view may only be reached from its own dispatcher`);
  }
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

if (examined !== SURFACES.length) failures.push(`validate_real_event_workspace_reads_runtime examined ${examined} of ${SURFACES.length} surfaces`);
if (!examined) failures.push("validate_real_event_workspace_reads_runtime examined zero surfaces");

if (failures.length) {
  console.error("validate_real_event_workspace_reads_runtime: FAIL — a real event must read its own rows; only a seed event keeps fixtures");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_real_event_workspace_reads_runtime: PASS — ${examined} workspace surfaces read the runtime store, each with an honest empty state; ${new Set(seedViews).size} seed views reachable only from their own dispatcher.`);
