const fs = require("fs");
const path = require("path");

/**
 * One chrome stack, one sticky container.
 *
 * Two agents built two sticky bars without seeing each other's work, and on 16 Sep 2026 they met on
 * /venue/{eventId}/stage as the owner: the venue nav covered the "Stream credentials" heading at
 * rest, slid up over the command bar on scroll, ended mid-word at "Run of Sh" with nothing to say
 * it scrolled, and printed the event name a second time. Each bar was pinned to top-0 on its own
 * with no shared offset, which is a collision the moment a second bar exists.
 *
 * What this holds:
 *
 *  1. Exactly ONE element in the event chrome is sticky, and it is the one EventChromeStack owns.
 *     Nothing else on a venue page pins itself, including the credentials panel.
 *  2. The stack is ordered: command bar on top, venue nav directly beneath it as a sub-bar, and the
 *     sub-bar knows whether it is subordinate so it can drop what the bar above already says.
 *  3. The event name renders once in the stack: the sub-bar prints it only when there is no
 *     command bar above it.
 *  4. One component claims live state. The sub-bar's own live pill is gone; the nav marker owns it.
 *  5. The nav can never render silently clipped: it scrolls, and it carries a visible fade and a
 *     spoken hint at exactly the widths where it can run past the edge.
 *  6. Every control on the bar is sized from the shared chip recipe, which is what keeps the stack
 *     under the 96px budget on a 414px phone. A hand-rolled px-3/py-1.5/text-sm chip is how the
 *     stack silently grows a row back.
 *
 * Hard-fails when it examines nothing, so an empty walk cannot pass.
 */

const failures = [];
let examined = 0;
function check(condition, message) { examined += 1; if (!condition) failures.push(message); }
function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, "utf8");
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}
/** Class names only. A comment explaining why nothing else is pinned is not a second pinned bar. */
function classNames(body) {
  return (body.match(/className=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g) || []).join("\n");
}

const STACK = "components/command/EventChromeStack.tsx";
const CHROME = "components/venue/VenueChrome.tsx";
const SUB_BAR = "components/venue/VenueHeader.tsx";
const NAV = "components/venue/VenueNav.tsx";
const BAR = "components/command/EventCommandBar.tsx";
const CHIPS = "components/command/commandChrome.ts";

// ---- 1. exactly one sticky element in the whole event chrome -----------------------------------
const chromeTrees = [...walk("components/venue"), ...walk("components/command"), ...walk("components/moderation"), ...walk("app/venue")];
check(chromeTrees.length > 20, `The chrome walk found only ${chromeTrees.length} files; it must not pass on an empty tree.`);
const pinned = [];
for (const file of chromeTrees) {
  examined += 1;
  const pins = classNames(read(file)).match(/\bsticky\b/g) || [];
  for (let i = 0; i < pins.length; i += 1) pinned.push(file);
}
check(
  pinned.length === 1 && pinned[0] === STACK,
  `Exactly one element in the venue chrome may be sticky, and it must be the one in ${STACK}. Found ${pinned.length}: ${pinned.join(", ") || "none"}.`,
);
const stack = read(STACK);
check(/className="sticky top-0 z-30[^"]*" data-chrome-stack=""/.test(stack), `${STACK} must pin the stack to the top of the page and mark itself data-chrome-stack.`);
// A sticky element only travels inside its own parent's box, so the pin cannot be wrapped.
check(
  /return \(\s*<>\s*<div className="sticky/.test(stack),
  `${STACK} must return a fragment: wrapping the pinned div in a container as tall as the chrome unpins it as soon as the page scrolls past the chrome.`,
);

// ---- 2. the credentials scroll, below the pinned container -------------------------------------
check(
  stack.indexOf("<EventCommandCredentials") > stack.indexOf("data-chrome-stack"),
  `${STACK} must render the stream credentials AFTER the pinned div, so they scroll with the page.`,
);
const bar = read(BAR);
check(
  bar.indexOf("CommandBarCredentials({") > bar.indexOf("export async function EventCommandCredentials"),
  `${BAR} must not render the credentials inside the bar itself: pinned credentials are what the venue nav landed on top of.`,
);
check(/export async function EventCommandCredentials/.test(bar), `${BAR} must export EventCommandCredentials so the panel can live below the stack.`);
check(bar.includes('label="Stream credentials"'), "The credentials must still render through SafeSection: one dead read must not blank the chrome.");
check(bar.includes("commandBarVisibleTo(viewer)") && (bar.match(/commandBarVisibleTo\(viewer\)/g) || []).length >= 2, `${BAR} must gate the credentials on the same owner/operator cookie read as the bar; it carries the stream key.`);
const credentials = read("components/command/CommandBarGoLive.tsx");
check(!/\bsticky\b/.test(classNames(credentials)), "The credentials panel must scroll with the page, never pin itself.");

// ---- 3. the stack is ordered, and every event area uses it -------------------------------------
const chrome = read(CHROME);
check(chrome.includes("<EventChromeStack"), `${CHROME} must build the venue chrome through the one shared stack.`);
check(
  chrome.indexOf("commandBar") < chrome.indexOf("<VenueHeader"),
  `${CHROME} must put the command bar above the venue nav: the nav is the sub-bar, not the other way round.`,
);
check(chrome.includes("subordinate={hasCommandBar}"), `${CHROME} must tell the sub-bar whether a command bar is above it, or it cannot drop what that bar already says.`);
const LAYOUTS = [
  "app/app/events/[eventId]/layout.tsx",
  "app/crew/events/[eventId]/layout.tsx",
  "app/venue/[eventId]/layout.tsx",
  "app/speaker/events/[eventId]/layout.tsx",
  "app/sponsor/events/[eventId]/layout.tsx",
];
for (const layout of LAYOUTS) {
  const body = read(layout);
  const viaStack = body.includes("<EventChromeStack") || body.includes("<VenueChrome");
  check(viaStack, `${layout} must mount the command bar inside the one sticky stack, never as a bar pinned on its own.`);
}
check(read("app/venue/[eventId]/layout.tsx").includes("<VenueChrome"), "The venue layout must render the venue chrome, which is the only place the two bars can share a container.");

// ---- 4. the event name renders once in the stack ------------------------------------------------
const subBar = read(SUB_BAR);
check(
  /subordinate \? null : \(/.test(subBar),
  `${SUB_BAR} must hide the wordmark and the event name when a command bar is above it: that is the name the owner saw printed twice.`,
);
check(
  subBar.indexOf("model.eventName") > subBar.indexOf("subordinate ? null : ("),
  `${SUB_BAR} may print the event name only inside the branch that runs when it is the whole stack.`,
);
check((subBar.match(/model\.eventName/g) || []).length === 1, `${SUB_BAR} must print the event name at most once.`);
check(read("components/command/EventSwitcherMenu.tsx").includes('data-testid="command-bar-event-name"'), "The command bar keeps the event name it already owned, on the switcher.");

// ---- 5. one component claims live state ---------------------------------------------------------
check(!fs.existsSync("components/venue/LivePill.tsx"), "The sub-bar's live pill is retired: it claimed LIVE NOW beside a command bar reading ENDED. The nav marker owns live state.");
for (const file of [SUB_BAR, CHROME]) {
  examined += 1;
  if (/LivePill|LIVE NOW/i.test(read(file))) failures.push(`${file} must not carry a second live indicator; navMarkerFor owns it.`);
}
const nav = read(NAV);
check(nav.includes("navMarkerFor(item.surface, activity)"), `${NAV} must keep deriving the live marker from the one activity read.`);
check(bar.includes('data-chrome-live-state="command-bar"'), `${BAR} must mark its status pill as the operator-facing owner of show state, so a third claim is obvious in a diff.`);

// ---- 6. the nav cannot render silently clipped ---------------------------------------------------
check(nav.includes("overflow-x-auto"), `${NAV} must scroll rather than clip.`);
check(nav.includes("data-nav-overflow-fade"), `${NAV} must show a fade at the edge wherever the row can run past it.`);
check(/data-nav-overflow-fade[^>]*|[^>]*xl:hidden/.test(nav) && nav.includes("xl:hidden"), `${NAV}'s fade must render at the widths where the row can overflow.`);
check(nav.includes("data-nav-scroll-hint"), `${NAV} must say, to a screen reader as well, that the menu scrolls.`);
check(!/\bhidden\b(?![^"]*xl)/.test(classNames(nav).replace(/xl:hidden/g, "")), `${NAV} must not simply hide items that do not fit; clipping in silence is the defect.`);

// ---- 7. the stack stays shallow -------------------------------------------------------------------
const chips = read(CHIPS);
for (const token of ["export const COMMAND_CHIP", "export const COMMAND_CHIP_MUTED", "export const COMMAND_CHIP_STATIC"]) {
  check(chips.includes(token), `${CHIPS} must export ${token}: the stack's height is decided in one place.`);
}
check(/shrink-0 whitespace-nowrap rounded-full px-2\.5 py-1 text-xs/.test(chips), `${CHIPS} must keep the compact chip; a taller chip puts the command bar back to three rows on a phone and pushes the video off the first screen.`);
// Every control that sits on the bar imports the recipe rather than hand-rolling the old tall chip.
const ON_THE_BAR = [
  "components/command/EventSwitcherMenu.tsx",
  "components/command/EventHealthDot.tsx",
  "components/command/EnterTheRoomMenu.tsx",
  "components/command/CommandBarCodes.tsx",
  "components/command/CommandBarGoLive.tsx",
  "components/moderation/StageRequestsToggle.tsx",
  "components/moderation/EndShowControl.tsx",
];
for (const file of ON_THE_BAR) {
  const body = read(file);
  check(body.includes('from "@/components/command/commandChrome"'), `${file} puts a control on the command bar and must size it from the shared chip recipe.`);
  check(!/rounded-full bg-white\/1[05] px-3 py-1\.5 text-sm/.test(body), `${file} still hand-rolls the old tall bar chip; that is how the stack grows a row back.`);
}
check(/flex-nowrap items-center gap-1\.5 overflow-x-auto px-3 py-1/.test(bar), `${BAR} must keep the one compact scrolling row the 96px phone budget was measured against; a wrapping bar was three rows deep on a phone.`);
check(bar.includes("data-chrome-overflow-fade"), `${BAR} must show the same fade the nav does wherever its row can run past the edge.`);
check(read(CHIPS).includes("export const COMMAND_PANEL"), `${CHIPS} must own the menu panel recipe: a row that scrolls clips an absolutely positioned dropdown, so every bar menu has to escape it the same way.`);
for (const menu of ["components/command/EventSwitcherMenu.tsx", "components/command/EventHealthDot.tsx", "components/command/EnterTheRoomMenu.tsx", "components/command/CommandBarCodes.tsx"]) {
  const body = read(menu);
  check(body.includes("COMMAND_PANEL"), `${menu} opens a menu off the scrolling bar and must use the shared panel recipe, or its panel is clipped by the row.`);
  check(!/className="absolute [^"]*z-40/.test(body), `${menu} must not pin its panel with a bare absolute inside the scrolling row.`);
}
check(/py-1 text-white/.test(subBar), `${SUB_BAR} must keep the compact row padding the 96px phone budget was measured against.`);

// ---- 8. the shell no longer renders chrome of its own --------------------------------------------
const shell = read("components/venue/VenuePageShell.tsx");
check(!shell.includes("<VenueHeader"), "VenuePageShell must not render the nav any more: the layout owns the whole stack, or the two bars cannot share a container.");
check(shell.includes("venueChromeData(model.eventId)"), "VenuePageShell must read the chrome data through the per-request cache, so the activity probe still runs once per page.");
check(read("services/venue/venueChromeData.ts").includes("getVenueActivity(model).catch(() => EMPTY_VENUE_ACTIVITY)"), "The chrome data read must fail soft: a dead read costs the markers, never the page.");

if (examined < 60) failures.push(`validate_venue_chrome_stack examined only ${examined} assertions; it must not pass on an empty walk.`);
if (failures.length) {
  console.error("validate_venue_chrome_stack: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_venue_chrome_stack: PASS — ${examined} assertions; one sticky container across ${chromeTrees.length} chrome files, command bar above the sub-bar, the event name and the live claim owned once each, the nav never silently clipped, and every bar control sized from the one chip recipe.`);
