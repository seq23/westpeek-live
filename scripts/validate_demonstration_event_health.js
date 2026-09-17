const fs = require("fs");
const path = require("path");

/**
 * A demonstration event is not a failing event — and a failing event is still a failing event.
 *
 * The Nova Founder Summit demo is marked LIVE so the venue looks like a real show to whoever is
 * being shown it. Nothing publishes to it, because there is nothing to publish. So the owner's
 * command bar read "1 failing: webhook" through every demonstration (17 Sep 2026). The probe was
 * right, and what it was right about was a fiction.
 *
 * The fix is the honest one: the demo declares itself in its own config, and the probes ask "is a
 * stream EXPECTED right now" instead of "is this event live". The fix that was NOT taken, and must
 * never be taken later, is suppressing the signal — a health panel that hides a red is worse than
 * one that shows an explainable red. So this guards both halves:
 *
 *  1. Only an event whose own config file says so is a demonstration, and a runtime event (every
 *     real event anyone creates) cannot become one by accident.
 *  2. Nothing is suppressed. All nine signals are still built, still settled through settleAll,
 *     still named with a source; there is no early return, no filter, no level override.
 *  3. A real live event with no webhook and no poll STILL goes red. The red branch is still there,
 *     still reachable, and the behavioural proof of it lives in tests/unit/eventCommandBar.test.ts.
 *  4. The panel says out loud that it is reading a demonstration, so a green here can never be
 *     mistaken for "a real show is healthy".
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
function code(body) { return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); }

const SERVICE = "services/venue/eventHealthService.ts";
const CONFIG_REPO = "services/events/eventConfigRepository.ts";
const DOT = "components/command/EventHealthDot.tsx";
const TICK = "app/api/venue/tick/route.ts";
const TEST = "tests/unit/eventCommandBar.test.ts";
const service = code(read(SERVICE));
const configRepo = code(read(CONFIG_REPO));

for (const file of [SERVICE, CONFIG_REPO, DOT, TICK, TEST]) {
  examined += 1;
  if (!read(file)) fail(`${file} is missing; this validator cannot prove anything about code it cannot see.`);
}

// ---------------------------------------------------------------------------
// 1. Only an event that declares itself is a demonstration.
// ---------------------------------------------------------------------------
const eventsIndex = JSON.parse(read("data/events/events.json") || '{"events":[]}');
check(Array.isArray(eventsIndex.events) && eventsIndex.events.length > 0, "data/events/events.json lists no events; nothing to classify.");
const declared = [];
for (const entry of eventsIndex.events || []) {
  examined += 1;
  const config = JSON.parse(read(entry.configPath) || "{}");
  if (config.demonstration === true) declared.push(entry.slug);
  else if ("demonstration" in config) fail(`${entry.configPath} sets demonstration to something other than true; it is a flag, not a mode.`);
}
check(declared.length === 1 && declared[0] === "demo", `Exactly one seeded event may declare itself a demonstration and it is the demo; found [${declared.join(", ")}]. A real client event marked as a demonstration would stop reporting its own failures.`);
check(/demonstration\?: boolean;/.test(configRepo), `${CONFIG_REPO} must type the flag on EventConfigRecord rather than reading an untyped field.`);
check(/export function isDemonstrationEvent/.test(configRepo), `${CONFIG_REPO} must expose isDemonstrationEvent; the probes may not test a slug themselves.`);
check(/return Boolean\(getEventConfig\(slugOrEventId\)\?\.demonstration\);/.test(configRepo), "isDemonstrationEvent must answer from the event's own config file and nothing else — never a hard-coded id, a slug test or an environment switch.");
// dynamicEventConfig builds the record for every runtime (real) event. If it ever sets the flag,
// a real event could become a demonstration and stop reporting its own failures.
const dynamic = configRepo.slice(configRepo.indexOf("function dynamicEventConfig"), configRepo.indexOf("function dynamicAttendeeConfig"));
check(dynamic.length > 0 && !/demonstration/.test(dynamic), "dynamicEventConfig must never set demonstration: every real event is built through it, and a real event may not classify itself as a sample.");

// ---------------------------------------------------------------------------
// 2. The probes ask "is a stream expected", and nothing is suppressed.
// ---------------------------------------------------------------------------
check(/const demonstration = isDemonstrationEvent\(eventId\);/.test(service), `${SERVICE} must read the flag from the event's config, not from its own list.`);
check(/const feedExpected = live && !demonstration;/.test(service), `${SERVICE} must express the rule once, as "live AND not a demonstration". Spread across branches it drifts.`);
for (const probe of ["feed", "webhook", "stage", "fallback"]) {
  examined += 1;
  const section = service.slice(service.indexOf(`// ${probe[0].toUpperCase()}${probe.slice(1)} —`));
  if (!section) fail(`${SERVICE} has no ${probe} probe section to check.`);
}
// The red branches still exist and still fire on a real live event.
check(/feedExpected\s*\n?\s*\? signal\("feed", "red"/.test(service), `${SERVICE} lost the red feed branch: a real live event publishing nothing must still fail.`);
check(/else if \(feedExpected\) signals\.push\(signal\("webhook", "red"/.test(service), `${SERVICE} lost the red webhook branch: a real live event with no webhook and no poll must still fail. This is the exact signal the owner saw, and it must keep working.`);
check(/signal\("fallback", feedExpected \? "red" : "yellow"/.test(service), `${SERVICE} must keep the fallback red for a real live event with no configured fallback.`);
check(!/\blive\b\s*\?\s*signal\("feed", "red"/.test(service), `${SERVICE} still judges the feed on "live" alone somewhere; every expectation of a stream goes through feedExpected.`);

// Not suppressed: all nine signals are still built and still settled.
check(/const settled = settleAll\(signals\);/.test(service), `${SERVICE} must keep settling every signal; settleAll is what stops an unmeasured probe reading green.`);
check(/level: worstLevel\(settled\)/.test(service), `${SERVICE} must keep taking the worst of the settled signals.`);
check(!/signals\.filter\(|signals\.splice\(|if \(demonstration\) return/.test(service), "A demonstration may not have signals removed, filtered or short-circuited. It is measured like anything else; only what a stream is EXPECTED to be doing changes.");
check(!/level: demonstration \?/.test(service), "A level may not be rewritten because the event is a demonstration. The branches say what is true; they do not launder a red into a green.");
const signalKeys = (service.match(/signals\.push\(/g) || []).length;
check(signalKeys >= 9, `${SERVICE} pushes ${signalKeys} signals; all nine must still be reported on a demonstration as on anything else.`);

// Every demonstration reading says so in its own words, and names the config as its source.
const demoDetails = service.match(/DEMO_WHY/g) || [];
check(demoDetails.length >= 3, `${SERVICE} must say in the signal's own detail why there is no feed; found ${demoDetails.length} uses. A green with no explanation is indistinguishable from a green that was earned.`);
check(/A real event live with this reading is failing and reads red here\./.test(service), `${SERVICE} must state, in the webhook signal itself, that a real event with this reading is failing. That sentence is what stops a green here being read as "everything is fine everywhere".`);
check(/"data\/events\/demo\/event\.json \(demonstration\)/.test(service), "A demonstration signal must name the config file it was read from. Every signal names its source; this one is no exception.");

// ---------------------------------------------------------------------------
// 3. The owner is told, on the panel, that this is a demonstration.
// ---------------------------------------------------------------------------
check(/demonstration: boolean;/.test(service), `${SERVICE} must put the flag on the report so the panel can say it.`);
check(/demonstration,/.test(service), `${SERVICE} must return the flag in the report it builds.`);
check(/\.\.\.report/.test(read(TICK)), `${TICK} must return the whole report, or the panel never receives the flag.`);
const dot = code(read(DOT));
check(/demonstration\?: boolean/.test(dot), `${DOT} must read the flag off the tick.`);
check(/data-testid="command-bar-health-demonstration"/.test(dot), `${DOT} must render a visible line saying this is a demonstration. Hiding the distinction is how a green becomes a lie.`);
check(/tick\?\.demonstration \? /.test(dot), `${DOT} must show that line only for a demonstration; a real event's panel must look exactly as it did.`);

// ---------------------------------------------------------------------------
// 4. The behaviour is proved by a test that runs the real service both ways.
// ---------------------------------------------------------------------------
const test = read(TEST);
check(/a real live event with no webhook and no poll still reads red/.test(test), `${TEST} must prove, against the real service, that a real event still fails this check. A static grep is not proof that a red can still happen.`);
check(/demonstration/.test(test) && /event-summit/.test(test), `${TEST} must run the real health report against the demo event as well, or nothing proves the fiction stopped reporting a failure.`);

if (examined < 25) fail(`validate_demonstration_event_health examined only ${examined} things; it must not pass on an empty loop.`);

if (failures.length) {
  console.error("validate_demonstration_event_health: FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`validate_demonstration_event_health: PASS — ${examined} checks across ${(eventsIndex.events || []).length} seeded events, the health probes, the tick route and the command bar panel.`);
