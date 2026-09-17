const fs = require("fs");
const path = require("path");

/**
 * THE ONE RULE, ENFORCED — plan §2.6, `docs/plans/OWNER_ONE_PLACE_AND_VIEW_AS.md`, item 10:
 *
 *   "an owner holding the master key never needs to enter a code, and never needs a second page to
 *    finish one intention. The validator walks the owner-reachable surfaces and fails if a primary
 *    action (go live, end show, stage requests, codes, enter the room) is reachable from only one
 *    of them."
 *
 * Both halves are here, because they are one sentence.
 *
 * NOTHING IN THIS FILE IS A HAND-KEPT LIST.
 *   - the surfaces come from `EVENT_COMMAND_BAR_SURFACES` and are cross-checked against
 *     `config/deployed-route-manifest.json` and against every layout that actually mounts the bar,
 *     so a surface added, renamed or dropped shows up here as drift rather than as silence;
 *   - the actions come from `lib/navigation/ownerPrimaryActions.ts`, whose ids must match the
 *     parenthetical in the plan word for word — the plan is parsed, not paraphrased;
 *   - reachability is measured by FOLLOWING IMPORTS from each surface's own routes to the module
 *     that implements the action. Never by looking for an identifier: two different components
 *     both exported as `EnterTheRoomMenu` is precisely how the preview personas shipped and stayed
 *     reachable from the event workspace and nowhere else, with a name-matching validator green
 *     over the top of it.
 *
 * Rule 0: it hard-fails when it examines zero surfaces, zero actions, zero routes or zero files.
 */

const ROOT = process.cwd();
const failures = [];
let examined = 0;

function check(condition, message) {
  examined += 1;
  if (!condition) failures.push(message);
}
function read(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) throw new Error(`validate_owner_one_place_rule: missing ${file}`);
  return fs.readFileSync(full, "utf8");
}
function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}
function walkFiles(dir, predicate, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(rel, predicate, out);
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}

// ─────────────────────────────────────────────────────────── 1. the actions, taken from the plan
const PLAN = "docs/plans/OWNER_ONE_PLACE_AND_VIEW_AS.md";
const plan = read(PLAN);
const planSentence = /fails if a primary action \(([^)]+)\) is reachable from only one of them/.exec(plan);
if (!planSentence) {
  throw new Error(`${PLAN} no longer states the §2.6 rule in the form this validator enforces. The rule is the plan's, not this file's: restore the sentence or change both together.`);
}
const planActionIds = planSentence[1].split(",").map((word) => word.trim().toLowerCase()).filter(Boolean);

const REGISTRY = "lib/navigation/ownerPrimaryActions.ts";
const registrySource = read(REGISTRY);
const actions = [...registrySource.matchAll(/id:\s*"([^"]+)"[\s\S]*?modules:\s*\[([^\]]*)\]/g)].map((match) => ({
  id: match[1],
  modules: [...match[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
}));

if (!actions.length) throw new Error(`${REGISTRY} declared no primary actions. A rule about every primary action cannot pass having examined none.`);
check(
  JSON.stringify(actions.map((action) => action.id)) === JSON.stringify(planActionIds),
  `${REGISTRY} and the plan disagree about what a primary action is. Plan: [${planActionIds.join(", ")}]. Registry: [${actions.map((a) => a.id).join(", ")}]. The registry is the plan's parenthetical as data; narrowing it here would narrow the rule.`,
);
for (const action of actions) {
  check(action.modules.length > 0, `"${action.id}" declares no module, so nothing about it can be measured.`);
  for (const module of action.modules) check(exists(module), `"${action.id}" names ${module}, which does not exist. A registry pointing at a deleted file measures nothing.`);
}

// ─────────────────────────────────────── 2. the surfaces, taken from the code and the route ledger
const SURFACES_FILE = "lib/navigation/eventCommandSurfaces.ts";
const surfaceSource = read(SURFACES_FILE);
const declared = [...surfaceSource.matchAll(/\{\s*pattern:\s*"([^"]+)",\s*label:\s*"([^"]+)"\s*\}/g)].map((match) => ({
  pattern: match[1],
  label: match[2],
  /** `/app/events/{id}` → `app/app/events/[eventId]`, the App Router directory that serves it. */
  dir: path.posix.join("app", match[1].replace("{id}", "[eventId]")),
  route: match[1].replace("{id}", "[eventId]"),
}));
if (!declared.length) throw new Error(`${SURFACES_FILE} declared no owner-reachable surfaces. There is nothing to walk, so nothing may pass.`);

const MANIFEST = "config/deployed-route-manifest.json";
const manifest = JSON.parse(read(MANIFEST));
const manifestPaths = manifest.routes.map((route) => route.path);
check(manifestPaths.length > 0, `${MANIFEST} lists no routes.`);

const BAR_MODULE = "components/command/EventCommandBar.tsx";

/** Every layout in the app that mounts the bar — the ground truth the declared list is checked against. */
const mountingLayouts = walkFiles("app", (file) => file.endsWith("/layout.tsx")).filter((file) => read(file).includes("EventCommandBar"));
check(mountingLayouts.length > 0, "No layout mounts the Event Command Bar. The owner-reachable surfaces do not exist.");

for (const surface of declared) {
  const layout = path.posix.join(surface.dir, "layout.tsx");
  check(exists(layout), `${surface.label} (${surface.pattern}) declares itself an owner surface but ${layout} does not exist.`);
  check(exists(layout) && read(layout).includes("EventCommandBar"), `${layout} must mount the Event Command Bar: an owner surface without the bar is a page hop by construction.`);
  const routes = manifestPaths.filter((route) => route === surface.route || route.startsWith(`${surface.route}/`));
  check(routes.length > 0, `${MANIFEST} has no deployed route under ${surface.route}. Either the surface is gone or the ledger is stale; both are drift.`);
}
for (const layout of mountingLayouts) {
  const dir = path.posix.dirname(layout);
  check(
    declared.some((surface) => surface.dir === dir),
    `${layout} mounts the Event Command Bar but its route family is not declared in ${SURFACES_FILE}. A new owner surface must be declared there, or the rule stops covering it.`,
  );
}

// ────────────────────────────────────────────── 3. reachability, by following imports from a surface
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
function resolveImport(specifier, fromFile) {
  let base;
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  else return undefined; // a package, not our code
  for (const extension of SOURCE_EXTENSIONS) {
    if (exists(base + extension)) return base + extension;
  }
  if (exists(base) && fs.statSync(path.join(ROOT, base)).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      if (exists(path.posix.join(base, `index${extension}`))) return path.posix.join(base, `index${extension}`);
    }
  }
  if (SOURCE_EXTENSIONS.some((extension) => base.endsWith(extension)) && exists(base)) return base;
  return undefined;
}

const importCache = new Map();
function importsOf(file) {
  if (importCache.has(file)) return importCache.get(file);
  const body = read(file);
  const specifiers = [
    ...[...body.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]),
    ...[...body.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]),
    ...[...body.matchAll(/\brequire\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]),
  ];
  const resolved = [...new Set(specifiers.map((specifier) => resolveImport(specifier, file)).filter(Boolean))];
  importCache.set(file, resolved);
  return resolved;
}

/** Every module a surface's own routes can reach, following imports to their end. */
function closureFor(surface) {
  const roots = [
    ...walkFiles(surface.dir, (file) => /\/(page|layout|template|default)\.tsx$/.test(file)),
  ];
  const seen = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    const file = queue.shift();
    for (const next of importsOf(file)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { roots, modules: seen };
}

let routesWalked = 0;
const closures = new Map();
for (const surface of declared) {
  const closure = closureFor(surface);
  routesWalked += closure.roots.length;
  check(closure.roots.length > 0, `${surface.label} (${surface.dir}) has no routes to walk. A surface with no pages cannot be proved to carry anything.`);
  closures.set(surface.pattern, closure);
}
if (!routesWalked) throw new Error("validate_owner_one_place_rule walked zero routes. It must not pass on an empty walk.");

const reachability = [];
for (const action of actions) {
  const reached = declared.filter((surface) => action.modules.some((module) => closures.get(surface.pattern).modules.has(module)));
  reachability.push({ action, reached });
  check(
    reached.length >= 2,
    `"${action.id}" is reachable from ${reached.length} owner surface${reached.length === 1 ? "" : "s"}${reached.length ? ` (${reached.map((s) => s.pattern).join(", ")})` : ""}. §2.6: a primary action reachable from only one surface is a second page the owner has to find. Put it on the Event Command Bar, which every surface mounts.`,
  );
  // The bar is on every surface, so in practice every surface reaches every primary action. Saying
  // so out loud is what turns "two is enough" into the rule the owner actually asked for.
  const missing = declared.filter((surface) => !reached.includes(surface));
  check(
    missing.length === 0,
    `"${action.id}" cannot be reached from ${missing.map((s) => s.pattern).join(", ")}. On those pages finishing that intention still costs a page hop.`,
  );
}

// ───────────────────────────────────── 4. the other half: an owner never types a code, anywhere
const NO_CODE = "lib/auth/ownerNeverEntersACode.ts";
const noCode = read(NO_CODE);
check(noCode.includes("commandBarVisibleTo("), `${NO_CODE} must ask the SAME predicate the command bar asks, or "who holds the master key" drifts between the bar and the gates.`);
check(/export async function holdsMasterKey/.test(noCode), `${NO_CODE} must export holdsMasterKey.`);
check(/export async function alreadyAuthorisedDestination/.test(noCode), `${NO_CODE} must export the one gate pass-through.`);
check(/canOwnerAccessPath\(candidate, owner\)/.test(noCode) && /canOperatorAccessPath\(candidate, operator\)/.test(noCode), `${NO_CODE} must only wave a visitor past a gate to a destination their cookie genuinely authorises.`);

// Nothing may bounce a master-key holder to a code gate. Every guest-role surface the owner can be
// sent into is walked, and any redirect to a gate must be guarded by the master key.
const GUEST_SURFACE_DIRS = [...new Set([...declared.map((surface) => surface.dir), "app/client"])];
let guardedFiles = 0;
let gateRedirectFiles = 0;
for (const dir of GUEST_SURFACE_DIRS) {
  for (const file of walkFiles(dir, (name) => /\.tsx?$/.test(name))) {
    const body = read(file);
    if (!/redirect\("\/production-access\//.test(body)) continue;
    gateRedirectFiles += 1;
    check(
      body.includes("holdsMasterKey("),
      `${file} sends its visitor to a code gate without asking whether they hold the master key. That bounce is the owner's "every time I click open it gives me another gate".`,
    );
    if (body.includes("holdsMasterKey(")) guardedFiles += 1;
  }
}
check(gateRedirectFiles > 0, "No owner-reachable surface redirects to a code gate any more. If that is genuinely true, this check has nothing to examine and must be retired deliberately rather than passing on an empty loop.");

// Every gate honours a cookie that already opens the destination, through the one implementation.
const GATES = ["owner", "operator", "crew", "special-guest"].map((name) => `app/production-access/${name}/page.tsx`);
for (const gate of GATES) {
  const body = read(gate);
  check(body.includes('from "@/lib/auth/ownerNeverEntersACode"'), `${gate} must use the shared pass-through: the owner and operator gates each grew a private copy of it and the crew and special-guest gates never got one.`);
  check(body.includes("alreadyAuthorisedDestination("), `${gate} must not ask for a code to reach somewhere the visitor's cookie already opens.`);
}
const privateCopies = walkFiles("app", (file) => /\.tsx?$/.test(file)).filter((file) => /(async )?function alreadyAuthorisedDestination/.test(read(file)));
check(privateCopies.length === 0, `A second copy of the gate pass-through lives in ${privateCopies.join(", ")}. One implementation, or they drift.`);

// The owner's own way into the room takes no code and no registration, and says so.
const menu = read("components/preview/EnterTheRoomMenu.tsx");
check(menu.includes("No code, no registration."), "Myself (host) must state, on the control itself, that it needs no code — it is the owner's proof the rule holds.");
check(!exists("components/command/EnterTheRoomMenu.tsx"), "The bar-local Enter the room placeholder is back. It is how the personas became unreachable from every surface but the event workspace.");

// ────────────────────────────────────────────────────────────────────────────────────── verdict
if (declared.length === 0 || actions.length === 0) throw new Error("validate_owner_one_place_rule examined zero surfaces or zero actions.");
if (examined < 30) failures.push(`validate_owner_one_place_rule examined only ${examined} assertions — it must not pass on an empty walk.`);

if (failures.length) {
  console.error("validate_owner_one_place_rule: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_owner_one_place_rule: PASS — ${examined} assertions.`);
console.log(`  surfaces (${declared.length}, from ${SURFACES_FILE}, cross-checked against ${MANIFEST} and every layout that mounts the bar): ${declared.map((s) => s.pattern).join(", ")}`);
console.log(`  routes walked: ${routesWalked}; modules resolved by import: ${new Set([...closures.values()].flatMap((c) => [...c.modules])).size}`);
console.log(`  actions (${actions.length}, matched word for word against §2.6 of the plan): ${actions.map((a) => a.id).join(", ")}`);
for (const row of reachability) console.log(`   - "${row.action.id}" reachable from ${row.reached.length}/${declared.length} surfaces`);
console.log(`  no-code half: ${gateRedirectFiles} gate redirect${gateRedirectFiles === 1 ? "" : "s"} on owner surfaces, ${guardedFiles} guarded by the master key; ${GATES.length} gates share one pass-through.`);
