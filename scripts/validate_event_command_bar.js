const fs = require("fs");
const path = require("path");

/**
 * One rule, enforced (plan §2.6): an owner holding the master key never needs a second page to
 * finish one intention, and never needs a code.
 *
 * So: every primary owner action — go live, end show, stage requests, codes, enter the room — must
 * be reachable from the Event Command Bar AND from at least one surface that is not the bar. One
 * render site means the page hopping is back the moment that page is the wrong one; and a control
 * that lives ONLY on the bar disappears with it.
 *
 * And the bar itself must never render for anyone but owner and operator. It carries go live, end
 * show, the access codes and the stream key; an attendee who reaches /venue/** must see none of it.
 *
 * Hard-fails when it examines nothing, so an empty walk cannot pass.
 */

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, "utf8");
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const failures = [];
let examined = 0;
function check(condition, message) { examined += 1; if (!condition) failures.push(message); }

const BAR = "components/command/EventCommandBar.tsx";
const bar = read(BAR);

// ---------------------------------------------------------------- the bar is owner/operator only
check(
  /if \(!commandBarVisibleTo\(viewer\)\) return null;/.test(bar),
  `${BAR} must return null unless commandBarVisibleTo(viewer) — it carries go live, the codes and the stream key.`,
);
// The predicate itself: owner and operator, nobody else. Widening it here widens every surface.
const predicate = read("lib/navigation/eventCommandSurfaces.ts");
check(
  /export function commandBarVisibleTo\(viewer: \{ kind: string \}\) \{\s*return viewer\.kind === "owner" \|\| viewer\.kind === "operator";/.test(predicate),
  "commandBarVisibleTo must admit owner and operator only — never an attendee, never plain crew.",
);
check(bar.includes('await getCrewViewer(eventId)'), `${BAR} must resolve the viewer from the signed cookies, not from a prop a caller could fake.`);
// The guard lives INSIDE the component, so every mount is safe. Nothing may mount a pre-decided viewer.
check(!/export async function EventCommandBar\([^)]*viewer/.test(bar), `${BAR} must not accept a viewer prop: the guard has to be the component's own cookie read.`);

// The combined poll behind the health dot is owner/operator only too — its signals name internal
// failures (missing tables, LiveKit refusals) an attendee must never read.
const tick = read("app/api/venue/tick/route.ts");
check(/if \(!commandBarVisibleTo\(viewer\)\)/.test(tick) && tick.includes("403"), "app/api/venue/tick must refuse anyone the bar is not for, with a 403 — its signals name internal failures.");
check(!/streamKey|livekitStreamKey/.test(tick), "The health tick must never carry a stream key.");

// ------------------------------------------------------------------- mounted on every event area
const LAYOUTS = [
  "app/app/events/[eventId]/layout.tsx",
  "app/crew/events/[eventId]/layout.tsx",
  "app/venue/[eventId]/layout.tsx",
  "app/speaker/events/[eventId]/layout.tsx",
  "app/sponsor/events/[eventId]/layout.tsx",
];
for (const layout of LAYOUTS) {
  const body = read(layout);
  check(body.includes("EventCommandBar"), `${layout} must mount the Event Command Bar: the plan puts it on EVERY event-scoped page.`);
  // Fail soft: one dead read must leave a named chip, never blank the page under the bar.
  check(/render=\{\(\) => EventCommandBar\(/.test(body), `${layout} must render the bar through SafeSection so a failed read cannot blank the page.`);
}

// ------------------------------------------------- no primary action is reachable from one place
const renderSites = [...walk("app"), ...walk("components")];
const bodies = new Map(renderSites.map((file) => [file, read(file)]));

/** Files that reach the action, excluding the file that defines it. An import IS a render site. */
function sitesFor(token, definedIn) {
  return renderSites.filter((file) => file !== definedIn && bodies.get(file).includes(token));
}

const ACTIONS = [
  { name: "go live", token: "goLiveAction", definedIn: "lib/actions/goLiveActions.ts", onBar: "components/command/CommandBarGoLive.tsx" },
  { name: "end show", token: "EndShowControl", definedIn: "components/moderation/EndShowControl.tsx", onBar: "components/command/CommandBarGoLive.tsx" },
  { name: "stage requests", token: "StageRequestsToggle", definedIn: "components/moderation/StageRequestsToggle.tsx", onBar: BAR },
  { name: "codes", token: "CommandBarCodes", definedIn: "components/command/CommandBarCodes.tsx", onBar: BAR, alsoCountedAs: { token: "EventAccessCodesPanel", definedIn: "components/events/EventAccessCodesPanel.tsx" } },
  { name: "enter the room", token: "EnterTheRoomMenu", definedIn: "components/command/EnterTheRoomMenu.tsx", onBar: BAR, alsoCountedAs: { token: "/stage`", definedIn: "components/command/EnterTheRoomMenu.tsx" } },
];

for (const action of ACTIONS) {
  const onBar = bodies.get(action.onBar) || read(action.onBar);
  check(onBar.includes(action.token) || (action.name === "go live" && onBar.includes("goLiveAction")), `The bar must offer "${action.name}" (${action.onBar} does not mention ${action.token}).`);
  const direct = sitesFor(action.token, action.definedIn);
  const extra = action.alsoCountedAs ? renderSites.filter((file) => bodies.get(file).includes(action.alsoCountedAs.token) && file !== action.alsoCountedAs.definedIn) : [];
  const surfaces = new Set([...direct, ...extra]);
  check(
    surfaces.size >= 2,
    `"${action.name}" is reachable from only ${surfaces.size} surface (${[...surfaces].join(", ") || "none"}). An owner action must exist on the bar AND on its own page — one render site puts the page hopping back.`,
  );
}

// ------------------------------------------------------ every bar section fails soft on its own
const sections = ["Event switcher", "Health", "Go live", "Stage requests", "Codes", "Stream credentials"];
for (const label of sections) check(bar.includes(`label="${label}"`), `The bar must render its "${label}" section through SafeSection: one dead probe must not blank the bar.`);

// ------------------------------------------------------------------- the health signal is honest
const health = read("lib/venue/eventHealth.ts");
check(/RANK[^\n]*red: 3[^\n]*yellow: 2[^\n]*unknown: 1[^\n]*green: 0/.test(health), "The dot must rank red > yellow > unknown > green, so it can only read green when every signal was actually measured.");
check(/export function settle\(signal: HealthSignal\)[\s\S]{0,200}if \(signal\.checkedAt\) return signal;[\s\S]{0,120}level: "unknown"/.test(health), "A signal with no checkedAt must be forced to unknown: a probe that did not run reads grey, never green.");

const service = read("services/venue/eventHealthService.ts");
check(service.includes("settleAll(signals)"), "The health report must pass every signal through settleAll before returning it.");
check(/function unmeasured\(/.test(service), "The service needs an explicit 'unmeasured' shape so a dead probe cannot be written as a green one.");
// Grey where we genuinely cannot see: capacity and per-attendee connection are not probed here.
check(/unmeasured\("capacity"/.test(service), "Capacity is not exposed to this Worker — it must read unmeasured rather than an invented percentage.");
for (const source of ["LiveKit Ingress/ListIngress", "crewPageReadsProbe", "NEXT_PUBLIC_BUILD_ID", "attendee_profiles", "live_chat_messages"]) {
  check(service.includes(source), `Every signal names its source; "${source}" is missing from the health service.`);
}

const dot = read("components/command/EventHealthDot.tsx");
check(dot.includes("/api/venue/tick?"), "The dot must poll the ONE combined endpoint.");
const fetches = (dot.match(/fetch\(/g) || []).length;
check(fetches === 1, `The panel must make ONE request per tick, not one per signal (found ${fetches} fetch calls).`);
check(dot.includes("LocalTime"), "Times in the panel and the show log must render in the viewer's zone through LocalTime.");
check(!/toLocale(Time|Date)?String\(\)/.test(dot), "No zone-less toLocale*() — the Worker's clock is UTC.");
check(dot.includes("health-source-"), "Every signal must show its source and last-checked time.");
check(dot.includes("health-action-"), "A yellow or red signal must show the button to press, not just a description.");
check(dot.includes("command-bar-health-log"), "The panel must carry the per-show event log.");

// ------------------------------------------------- 'Enter the room' stays a placeholder this branch
const enterTheRoom = read("components/command/EnterTheRoomMenu.tsx");
check(enterTheRoom.includes("TODO(work/preview-personas)"), "The Enter the room menu is a placeholder: it must name work/preview-personas as its owner.");
check(enterTheRoom.includes("enter-the-room-myself"), "Myself (host) must work today — the owner cookie already authorises /venue/**; there was simply no link.");

if (examined < 30) failures.push(`validate_event_command_bar examined only ${examined} assertions — it must not pass on an empty walk.`);
if (failures.length) {
  console.error("validate_event_command_bar: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_event_command_bar: PASS — ${examined} assertions; the bar is owner/operator only, mounted on all ${LAYOUTS.length} event areas, every primary action reachable from more than one surface, and no health signal reads green without a probe behind it.`);
