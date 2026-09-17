const fs = require("fs");
const path = require("path");

/**
 * One register prompt on a page, ever.
 *
 * On 16 Sep 2026 an unregistered viewer on the stage met three asks inside one 414px screen: the
 * stage panel's own "Keep watching. Want to join in?", the RegisterToTakePart card under the chat,
 * and a "My plan" pitch. Two pieces of work had each added a prompt without knowing about the
 * other. This validator is what stops the third one being added the same way.
 *
 *  1. Exactly ONE component in the repo may render a register invitation, and it is the shared
 *     card. It is marked `data-register-invitation`; nothing else may carry that marker.
 *  2. Every attendee venue route reaches that card AT MOST ONCE. Two renders on one page fail.
 *  3. Any file reachable from a venue route that links to registration must be one of the two
 *     shapes: the card, or a point-of-use ask marked `data-register-point-of-use`. A bespoke
 *     Register link with no marker is the defect, and it fails here.
 *  4. A point-of-use ask is folded away until the person presses the thing, so it is never a
 *     second Register button beside the card. Its link exists only once its state is open.
 *  5. The surviving card keeps what the staged ask was built for: watching costs nothing, what
 *     registering unlocks, fifteen seconds, one Register button, prominent once after about 45
 *     seconds of visible-tab watching, remembered, and nothing at all once registered.
 *
 * Hard-fails when it examines nothing.
 */
const failures = [];
let examined = 0;

const INVITATION_MARKER = "data-register-invitation";
const POINT_OF_USE_MARKER = "data-register-point-of-use";
const CANONICAL_CARD = path.join("components", "venue", "RegisterToTakePart.tsx");
const POINT_OF_USE_COMPONENT = path.join("components", "venue", "RegisterPointOfUse.tsx");
// A link into the event's registration form, written either as a template literal or a plain path.
const REGISTER_LINK = /href=\{?[`"'][^`"']*\/register/;

function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""; }
function fail(message) { failures.push(message); }
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Local files a component pulls in, resolved from the `@/` alias the repo imports everything by. */
function importsOf(file) {
  const out = [];
  for (const match of read(file).matchAll(/from\s+"(@\/[^"]+|\.[^"]*)"/g)) {
    const spec = match[1];
    const base = spec.startsWith("@/") ? path.join(".", spec.slice(2)) : path.join(path.dirname(file), spec);
    for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
      if (fs.existsSync(candidate)) { out.push(candidate); break; }
    }
  }
  return out;
}

/** Every local file a route can render, the route's own page and layout included. */
function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of importsOf(file)) if (!seen.has(next)) queue.push(next);
  }
  return [...seen];
}

// ---- 1. one shared component owns the invitation ------------------------------------------------
examined += 1;
const allComponents = [...walk("components"), ...walk("app")];
// A page that renders the card is not itself an invitation component; only a file that paints one is.
const declaredInvitations = allComponents.filter((file) => file !== CANONICAL_CARD && read(file).includes(`${INVITATION_MARKER}=`));
for (const file of declaredInvitations) fail(`${file} declares ${INVITATION_MARKER}; the register invitation is ${CANONICAL_CARD} and nothing else.`);
if (!fs.existsSync(CANONICAL_CARD)) fail(`Missing the one register invitation, ${CANONICAL_CARD}.`);
if (!fs.existsSync(POINT_OF_USE_COMPONENT)) fail(`Missing the shared moment-of-intent ask, ${POINT_OF_USE_COMPONENT}.`);

// ---- 2. at most one register invitation per attendee venue route --------------------------------
const routes = walk(path.join("app", "venue")).filter((file) => path.basename(file) === "page.tsx");
if (!routes.length) fail("No venue routes found; this validator cannot prove anything about a page it cannot see.");
for (const route of routes) {
  examined += 1;
  const reachable = reachableFrom(route);
  let renders = 0;
  for (const file of reachable) {
    // Not the card's own definition, which names itself in its export.
    if (file === CANONICAL_CARD) continue;
    renders += (read(file).match(/<RegisterToTakePart\b/g) || []).length;
  }
  if (renders > 1) fail(`${route} renders the register card ${renders} times; a page gets one register prompt, ever.`);

  // ---- 3. nothing else on the route asks -------------------------------------------------------
  for (const file of reachable) {
    examined += 1;
    const body = read(file);
    if (!REGISTER_LINK.test(body)) continue;
    if (body.includes(`${INVITATION_MARKER}=`) || body.includes(`${POINT_OF_USE_MARKER}=`)) continue;
    fail(`${file} (reachable from ${route}) links to registration without being the one card or a marked point-of-use ask. Fold it into ${CANONICAL_CARD} or into ${POINT_OF_USE_COMPONENT}.`);
  }
}

// ---- 4. a point-of-use ask is not a second button on arrival ------------------------------------
examined += 1;
{
  const body = read(POINT_OF_USE_COMPONENT);
  if (!body.includes("useState")) fail(`${POINT_OF_USE_COMPONENT} must hold its own open state; an ask that is always rendered is a second prompt.`);
  if (!/\{open \?/.test(body)) fail(`${POINT_OF_USE_COMPONENT} must render its line and its Register link only once open, so server markup carries one register call to action.`);
  if (!REGISTER_LINK.test(body)) fail(`${POINT_OF_USE_COMPONENT} must offer registration once the person has pressed the control.`);
  for (const need of ["chat", "networking", "stage-request", "vip"]) {
    examined += 1;
    if (!body.includes(`${need}:`) && !body.includes(`"${need}"`)) fail(`${POINT_OF_USE_COMPONENT} lost the ${need} ask; the moment-of-intent asks are not to be deleted, only kept out of the card's way.`);
  }
}

// ---- 5. the surviving card keeps the staged behaviour it was built for ---------------------------
examined += 1;
{
  const card = read(CANONICAL_CARD);
  const REQUIRED = [
    ["Watching costs you nothing", "the card must still say watching is free"],
    ["Post in the chat", "the card must name what registering unlocks"],
    ["Join networking", "the card must name what registering unlocks"],
    ["Show up on the People page", "the card must name what registering unlocks"],
    ["Raise your hand to speak", "the card must name what registering unlocks"],
    ["fifteen seconds", "the card must say how long it takes"],
    ["PROMINENT_AFTER_MS = 45_000", "prominence is still about forty-five seconds of watching"],
    ["document.visibilityState", "the forty-five seconds is visible-tab time, never wall clock"],
    ["localStorage.setItem(key", "the one firing is remembered so it never repeats"],
    ["if (registered) return null;", "every ask disappears once the person has registered"],
  ];
  for (const [token, why] of REQUIRED) {
    examined += 1;
    if (!card.includes(token)) fail(`${CANONICAL_CARD} lost "${token}": ${why}.`);
  }
  const ctas = (card.match(/<a\b/g) || []).length;
  if (ctas !== 1) fail(`${CANONICAL_CARD} renders ${ctas} links; the card carries one Register button.`);
}

// ---- 6. the prompts that were folded in stay folded in -------------------------------------------
for (const [file, why] of [
  ["components/venue/MyAgendaPanel.tsx", "My plan is a shortlist for registered people, not a register pitch"],
  ["components/venue/PeopleDirectory.tsx", "the People empty state says what it is without asking again"],
  ["components/venue/AttendeeStageJoinControls.tsx", "the raise-hand line explains what asking needs; it does not carry its own Register button"],
]) {
  examined += 1;
  if (REGISTER_LINK.test(read(file))) fail(`${file} links to registration again: ${why}.`);
}
examined += 1;
if (!read("services/venue/attendeeStageStatus.ts").includes('primary: "request" | "none"')) fail("attendeeStageStatus must not offer a `register` primary; the card owns that ask.");

if (examined < 40) fail(`validate_one_register_prompt examined only ${examined} things; it must not pass on an empty loop.`);

if (failures.length) {
  console.error("validate_one_register_prompt: FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`validate_one_register_prompt: PASS — ${examined} checks across ${routes.length} venue routes.`);
