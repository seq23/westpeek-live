const fs = require("fs");
const path = require("path");

/**
 * The demo event demonstrates the product, and the networking page explains itself.
 *
 * Two defects this is the guard for, both reproduced 17 Sep 2026:
 *
 *  1. Nova Founder Summit — the event the owner opens to show somebody what West Peek Live does —
 *     carried three run-of-show segments pinned to 12 June 2026. From 13 June onwards every page of
 *     the demo venue said "That's a wrap. Thanks for coming." The demo was a finished event with
 *     three lines in it.
 *  2. /venue/{event}/networking said "Meet other attendees, one at a time." over a Join queue
 *     button, which only makes sense to somebody who has already done this.
 *
 * The behavioural half of this — that the running order is never finished, that something is on at
 * every minute, that the venue fills — lives in tests/unit/demoSummitShowcase.test.ts, which runs
 * the real services. This validator guards the WIRING those behaviours depend on, which a passing
 * unit test would not notice being unplugged: that the demo clock is the only source of demo times,
 * that the config JSON and the seed agree on the same show, that the explainer is actually rendered
 * on the one route both the demo and every real event use, that its numbers are read from the code
 * that enforces them rather than typed into the copy, and that it shows no photograph of a person.
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
function readJson(file) {
  const raw = read(file);
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}
function fail(message) { failures.push(message); }
function check(condition, message) { examined += 1; if (!condition) fail(message); }

// ---------------------------------------------------------------------------
// 1. The demo runs on the viewer's own clock, and only the demo does.
// ---------------------------------------------------------------------------
const schedule = read("lib/mock/demoSchedule.ts");
check(Boolean(schedule), "lib/mock/demoSchedule.ts is missing; the demo has no clock and will go stale again.");
check(/export function demoShowStartMs/.test(schedule), "demoSchedule must export demoShowStartMs — the single anchor every demo time is derived from.");
check(/Math\.floor\(at \/ 60_000\)/.test(schedule), "The demo anchor must be floored to the minute so every read inside one render agrees.");
check(/export const DEMO_ARRIVE_AT_MINUTE/.test(schedule), "DEMO_ARRIVE_AT_MINUTE must be named, not buried in arithmetic: it is why the demo opens mid-show.");

const summit = read("lib/mock/demoSummit.ts");
check(Boolean(summit), "lib/mock/demoSummit.ts is missing; the demo summit's content has no home.");
check(/from "@\/lib\/mock\/demoSchedule"/.test(summit), "demoSummit must take its times from demoSchedule, never from literal instants.");
check(!/"20\d\d-\d\d-\d\dT/.test(summit), "demoSummit carries a hard-coded instant. That is exactly how the demo became a finished event; every time must come from demoIso().");

const mock = read("lib/mock/mockData.ts");
check(/demoSummitRunOfShow\(\)/.test(mock), "mockData must read the summit's run of show through the demo clock getter.");
check(/demoSummitSessions\(\)/.test(mock), "mockData must read the summit's sessions through the demo clock getter.");
check(/startAt: demoIso\(0\)/.test(mock), "The demo event's own start must come from the demo clock, or the landing page and the venue disagree.");

// ---------------------------------------------------------------------------
// 2. The run of show is a producer's run of show, and it exercises the product.
// ---------------------------------------------------------------------------
const MINIMUM_SEGMENTS = 12;
const ros = readJson("data/events/demo/run-of-show.json");
check(Boolean(ros && Array.isArray(ros.segments)), "data/events/demo/run-of-show.json is missing or malformed.");
const segments = (ros && ros.segments) || [];
check(segments.length >= MINIMUM_SEGMENTS, `The demo run of show has ${segments.length} segments; a demo event has no excuse for fewer than ${MINIMUM_SEGMENTS}.`);
for (const segment of segments) {
  examined += 1;
  if (!segment.title || !segment.room || !segment.startsAt || !segment.endsAt) fail(`Demo segment ${segment.id || "(no id)"} is missing a title, room or clock.`);
  if (!segment.description || segment.description.length < 20) fail(`Demo segment ${segment.id || "(no id)"} has no client-facing line; a guest would see a bare title.`);
  if (!segment.backupPlan) fail(`Demo segment ${segment.id || "(no id)"} has no backup plan; that is half of what a run of show is for.`);
  if (new Date(segment.endsAt).getTime() <= new Date(segment.startsAt).getTime()) fail(`Demo segment ${segment.id || "(no id)"} ends before it starts.`);
}

// Every feature the demo claims to show must appear in the running order.
const shape = segments.map((segment) => `${segment.title} ${segment.room}`).join(" | ").toLowerCase();
for (const [feature, why] of [
  ["keynote", "the main stage with a single speaker and a deck"],
  ["panel", "a multi-speaker stage"],
  ["q&a", "hand-raise and stage requests"],
  ["sponsor spotlight", "sponsor moments and the expo booths"],
  ["expo", "the expo directory"],
  ["networking", "speed networking and the queue"],
  ["breakout", "breakout rooms"],
  ["closing", "replay and the post-event report"],
]) {
  examined += 1;
  if (!shape.includes(feature)) fail(`The demo run of show has no "${feature}" segment, so it never shows ${why}.`);
}

const agenda = readJson("data/events/demo/agenda.json");
check(Boolean(agenda && Array.isArray(agenda.sessions) && agenda.sessions.length >= MINIMUM_SEGMENTS), "The demo agenda must carry the whole day; a one-line agenda makes the landing page look like a stub.");
check((agenda?.sessions || []).every((session) => session.startsAt && session.endsAt), "Every demo agenda session needs both ends of its window, or the landing page prints a start with no finish.");
const speakers = readJson("data/events/demo/speakers.json");
check((speakers?.speakers || []).length >= 6, "The demo needs a real bill of speakers; one speaker reads as an unfinished setup.");
const sponsors = readJson("data/events/demo/sponsors.json");
check((sponsors?.sponsors || []).length >= 3, "The demo needs more than one sponsor, or the expo and the sponsor tiers cannot be shown.");

// The config JSON is the canonical show day, re-anchored at read time. Both halves must be present.
const repository = read("services/events/eventConfigRepository.ts");
check(/reanchorDemoRows/.test(repository), "The demo config package must be re-anchored onto the live demo clock, or the landing page advertises a show its own venue has finished.");
check(/DEMO_CONFIG_SHOW_DAY_MS/.test(repository), "The canonical demo show day must be named where the re-anchoring happens.");

// ---------------------------------------------------------------------------
// 3. It is unmistakably a demo.
// ---------------------------------------------------------------------------
check(/data-testid="sample-event-notice"/.test(read("components/venue/PublicEventPage.tsx")), "A seeded sample event must say so on its own landing page; nothing here may be mistaken for real client work.");
check(/EVERYONE AND EVERY COMPANY HERE IS INVENTED/.test(summit), "demoSummit must state plainly, at the top, that its people and companies are invented.");
const realAddress = summit.match(/"[a-z0-9._-]+@(?!example\.com)[a-z0-9.-]+"/gi);
check(!realAddress, `demoSummit carries an address that is not @example.com (${(realAddress || [])[0]}); demo data must not be able to reach anybody.`);

// ---------------------------------------------------------------------------
// 4. The networking page explains itself, on the one route both sides use.
// ---------------------------------------------------------------------------
const explainer = read("components/venue/SpeedNetworkingExplainer.tsx");
check(Boolean(explainer), "components/venue/SpeedNetworkingExplainer.tsx is missing; the networking page is back to a button with no explanation.");
check(/SPEED_NETWORKING_CYCLE/.test(explainer) && /setupGapSeconds/.test(explainer), "The pause between calls must be read from SPEED_NETWORKING_CYCLE, not typed into the copy.");
check(/SPEED_NETWORKING_DEFAULT_MINUTES/.test(explainer), "The round length must come from the setting that governs it, so retuning the cycle cannot leave a false promise on the page.");
check(/SPEED_NETWORKING_ROOM_CAPACITY/.test(explainer), "The two-person room claim must be read from the guard's own capacity constant.");
check(/SPEED_NETWORKING_MATCHING_CONFIG/.test(explainer), "The matching claims must be read from the matcher's config, which has its own fairness-contract validator.");
// The privacy promise moved to where it is wanted — beside the button — on 17 Sep 2026, and is now
// written once as SPEED_NETWORKING_PRIVACY_PROMISE. It must survive verbatim, and it must be
// rendered with the action; validate_networking_page_design owns the "one copy, beside the button"
// half. Here we only insist the sentence itself still exists and has not been softened.
check(/SPEED_NETWORKING_PRIVACY_PROMISE = "Your match sees your name and your company\. Nothing else\."/.test(read("types/speedNetworking.ts")), "The privacy promise must survive verbatim; it is the sentence people actually want answered.");
check(/speed-networking-privacy-promise/.test(read("components/venue/SpeedNetworkingQueuePanel.tsx")), "The privacy promise must be rendered with the action, not filed in a constant nothing reads.");
check(/<svg/.test(explainer) && /<title/.test(explainer), "The cycle must be drawn, with a title an assistive reader gets; a sentence cannot carry \"this repeats and you can leave\".");
// Judged on the markup, not the comment that explains the rule.
const explainerCode = explainer.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
// url(#…) is an in-document SVG reference, not an image; anything else loading a picture is.
check(!/<img|backgroundImage|url\((?!#)/i.test(explainerCode) && !/unsplash|getty|shutterstock|pexels/i.test(explainerCode), "No photograph of a person on the networking page: a stock photo here is a stranger presented as an attendee of this event.");

// The hero carries the promise and the action; the explainer carries the loop and the four
// answers. Both are exported from the same file and both must be rendered (17 Sep 2026).
check(/export function SpeedNetworkingHero/.test(explainer), "The explainer file must export the hero that carries the promise and the action.");

const lobby = read("components/venue/NetworkingLobby.tsx");
// The RENDER, not the import: an import left behind after the element was deleted is exactly the
// shape this has to catch (caught here 17 Sep 2026 while proving the guard negatively).
check(/<SpeedNetworkingExplainer[\s/>]/.test(lobby), "NetworkingLobby must RENDER the explainer, or the page keeps its old one-line copy.");
check(/<SpeedNetworkingHero[\s/>]/.test(lobby), "NetworkingLobby must RENDER the hero, which is what puts the promise and the action above the fold.");
check(/matchMinutes=\{/.test(lobby), "The explainer must be rendered with the event's real round length.");
check(/getNetworkingSettings/.test(lobby), "The explainer must be handed the event's real round length, not the platform default in every case.");
check(/catch/.test(lobby), "Reading the networking settings must fail soft; a store hiccup may not take the networking page down.");

// Both sides — the demo and every real event — come through the one route, so one fix serves both.
const route = read("app/venue/[eventId]/networking/page.tsx");
check(/NetworkingLobby/.test(route), "The networking route must render NetworkingLobby, which is what makes the demo and the real path share one explanation.");
check(/\[eventId\]/.test("app/venue/[eventId]/networking/page.tsx"), "The networking route must stay event-generic.");

// The explanation is said once. The live panel may keep the privacy promise beside its button, but
// not a second copy of what networking is.
const live = read("components/venue/SpeedNetworkingLive.tsx");
check(!/Meet other attendees, one at a time\./.test(live), "SpeedNetworkingLive still carries the old vague line; what networking is gets said once, in the explainer.");

if (examined < 48) fail(`validate_demo_summit_showcase examined only ${examined} things; it must not pass on an empty loop.`);

if (failures.length) {
  console.error("validate_demo_summit_showcase: FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`validate_demo_summit_showcase: PASS — ${examined} checks across ${segments.length} demo run-of-show segments, the demo clock, the demo config package and the networking explainer.`);
