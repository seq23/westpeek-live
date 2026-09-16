const fs = require("fs");
const path = require("path");
/**
 * Every page an event has must be reachable from the spine exactly once. Before this, the event
 * workspace had 33 pages and a 18-tab strip: four pages rendered exactly what another page
 * rendered, and a dozen had no link at all. The spine map is the single source; this validator
 * walks the filesystem and compares.
 */
const spineFile = "lib/navigation/eventWorkspaceSpine.ts";
const source = fs.readFileSync(spineFile, "utf8");
const listed = [...source.matchAll(/\{\s*path:\s*"([^"]*)"/g)].map((match) => match[1]);
const redirects = Object.fromEntries([...source.slice(source.indexOf("SPINE_REDIRECTS")).matchAll(/(\w[\w-]*):\s*"([^"]*)"/g)].map((match) => [match[1], match[2]]));

const root = "app/app/events/[eventId]";
const pages = [];
const walk = (dir, prefix) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
    else if (entry.name === "page.tsx") pages.push(prefix);
  }
};
walk(root, "");
if (pages.length < 25) throw new Error(`only ${pages.length} event pages found; the walk is wrong`);

const failures = [];
for (const page of pages) {
  const isRedirect = Object.prototype.hasOwnProperty.call(redirects, page);
  const inSpine = listed.includes(page);
  if (isRedirect && inSpine) failures.push(`/${page} is both a redirect and a spine entry; pick one`);
  if (!isRedirect && !inSpine) failures.push(`/${page || "(event root)"} has a page but no spine entry — nothing links to it`);
  if (isRedirect) {
    const body = fs.readFileSync(path.join(root, page, "page.tsx"), "utf8");
    if (!body.includes("redirect(")) failures.push(`/${page} is listed as a redirect but still renders a page`);
    const target = redirects[page];
    if (target && !listed.includes(target)) failures.push(`/${page} redirects to /${target}, which is not in the spine`);
  }
}
for (const entry of listed) {
  if (!pages.includes(entry)) failures.push(`the spine lists /${entry || "(event root)"} but there is no page for it`);
}
const duplicates = listed.filter((entry, index) => listed.indexOf(entry) !== index);
if (duplicates.length) failures.push(`the spine lists these twice: ${duplicates.join(", ")}`);

// The spine must actually be mounted for every event page, and be fail-soft.
const layout = fs.readFileSync(`${root}/layout.tsx`, "utf8");
for (const token of ["EventWorkspaceSpine", "SafeSection"]) if (!layout.includes(token)) failures.push(`${root}/layout.tsx must render ${token}`);
const spine = fs.readFileSync("components/events/EventWorkspaceSpine.tsx", "utf8") + fs.readFileSync("components/events/EventSpineNav.tsx", "utf8");
for (const token of ["spine-whats-next", "spine-drawer", "spine-group-", "data-ready", "event-spine-scroll", "aria-current"]) if (!spine.includes(token)) failures.push(`EventWorkspaceSpine must carry ${token}`);
// Readiness dots only where something is measured: every readiness key must be answered.
const keys = [...source.matchAll(/readiness:\s*"([a-z-]+)"/g)].map((match) => match[1]);
for (const key of new Set(keys)) if (!spine.includes(`"${key}"`) && !spine.includes(`${key}:`)) failures.push(`readiness "${key}" is declared but never measured`);

if (failures.length) {
  console.error("validate_event_workspace_spine: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_event_workspace_spine: PASS — ${pages.length} event pages, ${listed.length} spine entries, ${Object.keys(redirects).length} merged duplicates, ${new Set(keys).size} measured readiness dots.`);
