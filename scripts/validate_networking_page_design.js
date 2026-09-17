const fs = require("fs");
const path = require("path");

/**
 * The networking page: the action first, a picture of the thing, and one of everything.
 *
 * Three defects, all reproduced on /venue/event-summit/networking on 17 Sep 2026:
 *
 *  1. "why do i have to scroll to join the queue and why is it at the bottom and seem so muted!?"
 *     The page ran headline → diagram → four cards → privacy line → register box → Join queue.
 *     The explainer sold it and then made the reader scroll past everything to act on it.
 *  2. "there are no drawings or anything of people doing a 1:1 chat — even the gray person
 *     placeholder? to show visually a 2x1 of how it works?" The cycle diagram drew the SEQUENCE
 *     and nothing drew the THING: two people, side by side, on camera.
 *  3. "the entire page needs to be designed pretty and gets people excited while staying our
 *     branding and color scheme." A flat stack of equal-weight boxes, every card the same.
 *
 * What this guards is the WIRING those fixes depend on, which a passing render test would not
 * notice being unplugged: that the action is rendered ABOVE the picture and the picture above the
 * detail, that the picture is RENDERED and not merely imported, that both the registered and the
 * unregistered reader are told which path is theirs before anything is offered them, that the
 * privacy promise has exactly one copy and it is beside the button, that there is never a second
 * Join button, that the looping motion is held still for anyone who asked for that, and that the
 * whole thing is drawn in the locked brand palette rather than a look somebody invented.
 *
 * The render, never the import. The first version of the guard on the sibling validator matched an
 * import and passed on an element that had been deleted from the JSX (17 Sep 2026); every check
 * here that claims something is on the page matches a JSX tag or a data-testid, and the ordering
 * checks compare positions of those tags.
 *
 * Hard-fails when it examines nothing.
 */

const failures = [];
let examined = 0;

const root = process.cwd();
function read(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}
function fail(message) { failures.push(message); }
function check(condition, message) { examined += 1; if (!condition) fail(message); }
/** The file with its comments removed: a rule about the page is judged on the markup, never on the prose explaining the rule. */
function code(body) { return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/^\s*\/\/.*$/gm, ""); }
function countOf(body, pattern) { return (body.match(pattern) || []).length; }

const LOBBY = "components/venue/NetworkingLobby.tsx";
const EXPLAINER = "components/venue/SpeedNetworkingExplainer.tsx";
const DRAWING = "components/venue/SpeedNetworkingPairDrawing.tsx";
const PANEL = "components/venue/SpeedNetworkingQueuePanel.tsx";
const LIVE = "components/venue/SpeedNetworkingLive.tsx";
const ROUTE = "app/venue/[eventId]/networking/page.tsx";
const GLOBALS = "app/globals.css";
const TYPES = "types/speedNetworking.ts";

const files = { LOBBY, EXPLAINER, DRAWING, PANEL, LIVE, ROUTE, GLOBALS, TYPES };
for (const [name, file] of Object.entries(files)) {
  examined += 1;
  if (!read(file)) fail(`${file} (${name}) is missing; this validator cannot prove anything about a page it cannot see.`);
}
const lobby = code(read(LOBBY));
const explainer = code(read(EXPLAINER));
const drawing = code(read(DRAWING));
const panel = code(read(PANEL));
const live = code(read(LIVE));
const globals = read(GLOBALS);

// ---------------------------------------------------------------------------
// 1. The order on the page: promise, ACTION, picture, detail.
// ---------------------------------------------------------------------------
const heroTag = lobby.indexOf("<SpeedNetworkingHero");
const heroClose = lobby.indexOf("</SpeedNetworkingHero>");
const panelInLobby = lobby.indexOf("SpeedNetworkingQueuePanel({");
const explainerTag = lobby.indexOf("<SpeedNetworkingExplainer");
check(heroTag >= 0, `${LOBBY} must RENDER <SpeedNetworkingHero>; the promise and the action are one block.`);
check(explainerTag >= 0, `${LOBBY} must RENDER <SpeedNetworkingExplainer>, or the page loses the loop and the four answers.`);
check(panelInLobby > heroTag && panelInLobby < heroClose, `${LOBBY} must render the queue panel INSIDE the hero. Outside it, the action falls below the picture and the page is back to its old order.`);
check(explainerTag > heroClose && heroClose > 0, `${LOBBY} must render the explainer AFTER the hero closes: the detail is for whoever wants it, and nobody reads it to press the button.`);
check(/matchMinutes=\{matchMinutes\}/.test(lobby), `${LOBBY} must hand both the hero and the explainer the event's real round length.`);
check(/getNetworkingSettings/.test(lobby) && /catch/.test(lobby), `${LOBBY} must read the event's own round length and fail soft; a store hiccup may not take the networking page down.`);

// Inside the hero: headline, then paragraph, then the action, then the picture. Positions, not hope.
const headline = explainer.indexOf("minutes on camera with one person you have not met");
const actionSlot = explainer.indexOf('data-testid="speed-networking-action-slot"');
const children = explainer.indexOf("{children}");
const pictureTag = explainer.indexOf("<SpeedNetworkingPairDrawing");
check(headline >= 0, `${EXPLAINER} lost the headline. It is the sentence that earns the press and it is not to be softened into body copy.`);
check(actionSlot > headline, `${EXPLAINER} must place the action slot after the headline — and it must exist. The action is the reason the page exists.`);
check(children > actionSlot && children < pictureTag, `${EXPLAINER} must render {children} — the real action — in that slot and ABOVE the drawing. This is exactly the ordering the owner walked the page and rejected.`);
check(pictureTag > actionSlot, `${EXPLAINER} must render the 2-up drawing AFTER the action, so the action is above the fold at phone width.`);
check(explainer.indexOf("CycleDiagram") > explainer.indexOf("export function SpeedNetworkingExplainer"), `${EXPLAINER} must keep the cycle diagram in the detail section below the action, not above it.`);

// The action must not be pushed down by anything between the paragraph and the slot.
const betweenParagraphAndAction = explainer.slice(headline, actionSlot);
check(!/<svg|<CycleDiagram|<SpeedNetworkingPairDrawing|<dl\b/.test(betweenParagraphAndAction), `${EXPLAINER} has a diagram, a drawing or a card list between the headline and the action. Nothing goes between the promise and the press.`);

// ---------------------------------------------------------------------------
// 2. The 2-up is RENDERED, and it is a drawing of the real room.
// ---------------------------------------------------------------------------
check(/<SpeedNetworkingPairDrawing[\s/>]/.test(explainer), `${EXPLAINER} must RENDER <SpeedNetworkingPairDrawing>. An import left behind after the element was deleted from the JSX is the exact failure this is written to catch.`);
check(countOf(drawing, /<PairTile[\s/>]/g) === 2, `${DRAWING} must render exactly two tiles. The product puts exactly two people in the room; a drawing with one or three is a lie about the feature.`);
check(/WHAT A ROUND LOOKS LIKE/.test(drawing), `${DRAWING} must label itself as a drawing. A reader who has joined nothing must never be shown something that reads as "you are matched".`);
check(/caption="Your match"/.test(drawing) && /caption="You"/.test(drawing), `${DRAWING} must caption both tiles, the way the real room does — a tile with no name under it is an anonymous stranger.`);
check(/TIME LEFT/.test(drawing) && /wpl-countdown-bar/.test(drawing), `${DRAWING} must show the countdown; the timer is half of what makes a round a round.`);
check(/<circle/.test(drawing) && /#73706a/.test(drawing), `${DRAWING} must draw the grey placeholder figure in each tile — the owner named that shape herself.`);
check(/role="img"/.test(drawing) && /aria-labelledby="wpl-net-pair-title"/.test(drawing) && /<title id="wpl-net-pair-title"/.test(drawing), `${DRAWING} must be labelled for a screen reader; a drawing nobody can hear is a decoration.`);
check(/matchMinutes/.test(drawing) && !/\b4 minutes\b/.test(drawing), `${DRAWING} must read the round length from the setting that enforces it. A design change may never turn a live value into hardcoded copy.`);
// NO PHOTOGRAPHS OF PEOPLE, ever. url(#…) is an in-document SVG reference, not an image.
for (const [file, body] of [[DRAWING, drawing], [EXPLAINER, explainer]]) {
  examined += 1;
  if (/<img|backgroundImage|url\((?!#)/i.test(body) || /unsplash|getty|shutterstock|pexels/i.test(body)) {
    fail(`${file} loads a picture. No photograph of a person on this page, ever: a stock photo here is a stranger presented as an attendee of this event.`);
  }
}

// ---------------------------------------------------------------------------
// 3. Both readers are told which path is theirs, and neither meets two buttons.
// ---------------------------------------------------------------------------
check(/joinSpeedNetworkingQueueAction/.test(panel) && /data-testid="networking-join"/.test(panel), `${PANEL} must carry the real Join form for a registered attendee: a server action, so it works before hydration and without JavaScript.`);
check(/You are registered/.test(panel), `${PANEL} must say the registered reader IS registered before it offers the button; the page was ambiguous about which path applied.`);
check(/You are not registered for this event yet/.test(live), `${LIVE} must tell an unregistered reader that registering comes first, in the action itself rather than in a separate card further down.`);
check(/need="networking"/.test(live) && /tone="primary"/.test(live), `${LIVE} must offer the unregistered reader the moment-of-intent ask as the page's PRIMARY control; a muted secondary is the defect the owner reported.`);
check(countOf(panel, /data-testid="networking-who-this-is-for"/g) + countOf(live, /data-testid="networking-who-this-is-for"/g) >= 3, "Every pre-join state must say who it is for. Registered idle (server), registered idle (client) and unregistered are three states and all three must name the reader's situation.");

// One Join, never two.
check(countOf(panel, /data-testid="networking-join"/g) === 1, `${PANEL} renders the Join button ${countOf(panel, /data-testid="networking-join"/g)} times; one action, not two.`);
check(countOf(live, /data-testid="networking-join"/g) === 1, `${LIVE} renders the Join button ${countOf(live, /data-testid="networking-join"/g)} times; one action, not two.`);
check(/serverJoinForm && !touched \? null :/.test(live), `${LIVE} must suppress its own idle card while the server's Join form is still the live one, or both render and the page shows two Join buttons at once.`);
check(!/networking-join|RegisterPointOfUse|\/register/.test(explainer), `${EXPLAINER} carries an action. The page has ONE Join, at the top; a quieter duplicate at the foot of the explainer is how this page got two of everything the first time.`);
check(!/<RegisterToTakePart/.test(panel) && !/<RegisterToTakePart/.test(live) && !/<RegisterToTakePart/.test(lobby), "The general register invitation is off the networking page. A page whose whole purpose is joining does not also need a card inviting the reader to join.");

// ---------------------------------------------------------------------------
// 4. The privacy promise: written once, rendered beside the button.
// ---------------------------------------------------------------------------
const SENTENCE = "Your match sees your name and your company. Nothing else.";
check(read(TYPES).includes(`SPEED_NETWORKING_PRIVACY_PROMISE = "${SENTENCE}"`), `${TYPES} must hold the privacy promise verbatim as the single source; it is the sentence people actually want answered.`);
let literalCopies = 0;
for (const file of [EXPLAINER, DRAWING, PANEL, LIVE, LOBBY]) {
  examined += 1;
  if (code(read(file)).includes(SENTENCE)) { literalCopies += 1; fail(`${file} types the privacy promise out again instead of rendering SPEED_NETWORKING_PRIVACY_PROMISE. Two copies drift.`); }
}
check(literalCopies === 0, "The privacy promise has more than one copy in the components.");
let promiseSpots = 0;
for (const [file, body] of [[PANEL, panel], [LIVE, live]]) {
  for (const match of body.matchAll(/data-testid="speed-networking-privacy-promise"[^>]*>\{([^}]*)\}/g)) {
    examined += 1;
    promiseSpots += 1;
    if (!match[1].includes("SPEED_NETWORKING_PRIVACY_PROMISE")) fail(`${file} renders the privacy promise from something other than the shared constant.`);
  }
}
check(promiseSpots >= 2, `The privacy promise must sit with the action in every pre-join state; found ${promiseSpots}. It is the last hesitation before pressing, so it does not live three screens away.`);
// Beside the button, not in a paragraph somewhere else: same component as a Join control.
for (const [file, body] of [[PANEL, panel], [LIVE, live]]) {
  examined += 1;
  if (body.includes("speed-networking-privacy-promise") && !/networking-join|need="networking"/.test(body)) fail(`${file} shows the privacy promise away from any Join control.`);
}

// ---------------------------------------------------------------------------
// 5. The locked brand, not a look somebody invented.
// ---------------------------------------------------------------------------
check(/bg-brand-black/.test(explainer), `${EXPLAINER} hero must use the brand black surface. Black and white first is locked in WEST_PEEK_BRAND_SYSTEM.md.`);
check(/bg-brand-orange/.test(panel) && /bg-brand-orange/.test(live), "The primary Join control must be West Peek Orange in every pre-join state; that is what makes it unmistakably the primary action.");
check(countOf(explainer, /bg-brand-orange\b/g) === 0, `${EXPLAINER} fills something with orange. Orange is an accent, not a background system: the only orange fill on this page is the thing to press.`);
const APPROVED_HEX = new Set(["#050505", "#ffffff", "#171717", "#f5f3ef", "#e7e3dc", "#73706a", "#f05a1a", "#fff1e9", "#2a2a2a"]);
for (const [file, body] of [[EXPLAINER, explainer], [DRAWING, drawing]]) {
  for (const hex of body.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
    examined += 1;
    if (!APPROVED_HEX.has(hex.toLowerCase())) fail(`${file} uses ${hex}, which is not in the West Peek palette. If you reached for a colour the system does not have, you left the brand.`);
  }
}
for (const [file, body] of [[EXPLAINER, explainer], [DRAWING, drawing], [PANEL, panel]]) {
  examined += 1;
  if (/\b(bg|text|border)-(blue|indigo|violet|purple|cyan|teal|sky|fuchsia)-\d{2,3}\b/.test(body)) fail(`${file} uses a generic SaaS colour. Blue, purple, indigo and cyan may not serve as a primary brand colour.`);
}
check(/focus-visible:outline/.test(panel) && /focus-visible:outline/.test(live), "The primary Join control must show a visible keyboard focus ring in every pre-join state.");

// ---------------------------------------------------------------------------
// 6. Motion that means something, and stops when asked.
// ---------------------------------------------------------------------------
const MOTION_CLASSES = ["wpl-countdown-bar", "wpl-cycle-flow"];
const reducedBlock = globals.slice(globals.indexOf("@media (prefers-reduced-motion: reduce)"));
check(globals.includes("@media (prefers-reduced-motion: reduce)"), `${GLOBALS} must hold the looping animations still for anyone who asked their system not to animate.`);
for (const klass of MOTION_CLASSES) {
  examined += 1;
  if (!new RegExp(`\\.${klass}\\s*[,{]`).test(globals)) fail(`${GLOBALS} does not define .${klass}; a class used in the JSX and defined nowhere animates nothing.`);
  if (!reducedBlock.includes(klass)) fail(`.${klass} keeps animating under prefers-reduced-motion.`);
}
// Nothing moves that is not one of those two: no other wpl- animation class may appear on this page.
for (const [file, body] of [[EXPLAINER, explainer], [DRAWING, drawing]]) {
  for (const match of body.matchAll(/className="([^"]*wpl-[^"]*)"/g)) {
    examined += 1;
    for (const klass of match[1].split(/\s+/).filter((token) => token.startsWith("wpl-"))) {
      if (!MOTION_CLASSES.includes(klass)) fail(`${file} uses ${klass}, which is not one of the two motions this page is allowed. Nothing on this page moves for its own sake.`);
    }
  }
}
check(countOf(explainer, /animate-/g) === 0 && countOf(drawing, /animate-/g) === 0, "Animation on this page goes through the two named classes, which are the two that respect prefers-reduced-motion.");

// ---------------------------------------------------------------------------
// 7. Phone width, and one page for the demo and every real event.
// ---------------------------------------------------------------------------
for (const [file, body] of [[EXPLAINER, explainer], [DRAWING, drawing], [PANEL, panel]]) {
  for (const match of body.matchAll(/min-w-\[(\d+)px\]/g)) {
    examined += 1;
    const width = Number(match[1]);
    const line = body.slice(Math.max(0, body.lastIndexOf("<", match.index)), match.index + 400);
    if (width > 360 && !line.includes("overflow-x-auto") && !body.slice(Math.max(0, match.index - 300), match.index).includes("overflow-x-auto")) {
      fail(`${file} pins ${width}px of width outside a horizontally scrollable container; the page must not scroll sideways on a phone.`);
    }
  }
}
check(/viewBox="0 0 600 330"/.test(drawing) && /className="h-auto w-full"/.test(drawing), `${DRAWING} must scale to its container rather than carry a fixed pixel size.`);
check(/NetworkingLobby/.test(read(ROUTE)), `${ROUTE} must render NetworkingLobby, which is what makes the demo event and every real event share one page.`);
for (const [file, body] of [[LOBBY, lobby], [EXPLAINER, explainer], [DRAWING, drawing], [PANEL, panel], [LIVE, live]]) {
  examined += 1;
  if (/event-summit|nova/i.test(body)) fail(`${file} names the demo event. One component serves the demo and every real event; a demo-only branch is a second page waiting to drift.`);
}

if (examined < 60) fail(`validate_networking_page_design examined only ${examined} things; it must not pass on an empty loop.`);

if (failures.length) {
  console.error("validate_networking_page_design: FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`validate_networking_page_design: PASS — ${examined} checks across the networking route, its hero, its action, the 2-up drawing, the brand palette and the reduced-motion contract.`);
