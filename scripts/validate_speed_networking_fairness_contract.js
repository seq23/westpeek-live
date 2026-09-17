#!/usr/bin/env node
const fs = require("fs");
const { spawnSync } = require("child_process");

/**
 * Speed networking: who sits out is a decision, not a remainder (16 Sep 2026).
 *
 * When the crew opens networking during a show a roomful presses Join in the same second, so every
 * queue row carries the same joinedAt and the sort has nothing left to work with: the tie-break is
 * arbitrary and stable. Measured on the source at 73d120b, 13 people who joined together took an
 * uneven share of the sit-outs over 12 rounds (spread 2, some people three times more than
 * others), the sit-out debt was thrown away the moment somebody was matched, and it grew once per
 * POLL rather than once per round — the more often an attendee's phone asked, the more the queue
 * thought it owed them.
 *
 * This asserts the fix is still wired AND that the fairness property still holds, by running the
 * deterministic simulation rather than only reading the source: a validator that greps for a
 * variable name proves nothing about a rotation.
 */

let examined = 0;
const failures = [];

function read(file) {
  if (!fs.existsSync(file)) { failures.push(`Missing ${file}`); return ""; }
  examined += 1;
  return fs.readFileSync(file, "utf8");
}

function check(file, tokens) {
  const body = read(file);
  if (!body) return "";
  for (const token of tokens) if (!body.includes(token)) failures.push(`${file} missing: ${token}`);
  return body;
}

function refuse(file, tokens) {
  const body = read(file);
  if (!body) return;
  for (const [token, why] of tokens) if (body.includes(token)) failures.push(`${file} must not contain ${token} — ${why}`);
}

// 1. One fairness order, used by every tier. Sitting out last round outranks older debt, older
//    debt outranks wait time, and wait time is the last word rather than the first — a room that
//    joined together has no wait times to be fair with.
check("services/speed-networking/speedNetworkingTiers.ts", [
  "function owedSeats",
  "candidate.priority ? 1_000_000 : 0",
  "function queueOrder",
  "const owed = owedSeats(b) - owedSeats(a)",
]);

// 2. With an odd number the person who sits out is chosen up front — the least-owed, held back
//    before any pairing runs — so it can never be whoever the draw or the score did not take.
check("services/speed-networking/speedNetworkingTiers.ts", [
  "const heldBack = pairable.length % 2 === 1 ? pairable[pairable.length - 1] : undefined",
  "const seating = heldBack ? pairable.filter((candidate) => candidate !== heldBack) : pairable",
]);

// 3. The debt is a floor at every tier, not a scoring nicety affinity can outvote: the scored tier
//    sorts on what the round owes BEFORE the score, and the other two hand out seats in the
//    fairness order. All three pair from `seating`, never from the raw queue.
const tiers = check("services/speed-networking/speedNetworkingTiers.ts", [
  "const owedBy = (option:",
  "scored.sort((a, b) => owedBy(b) - owedBy(a) || b.score - a.score",
  "for (const seed of seating)",
  "const entries: SpeedNetworkingEntry[] = seating.map((candidate, rank)",
]);
refuse("services/speed-networking/speedNetworkingTiers.ts", [
  ["scored.sort((a, b) => b.score - a.score", "affinity must not decide who is seated, only who they talk to"],
  ["999 - Math.min(999, candidate.timesSatOut", "the fairness order is encoded from the rank it already has, not from arithmetic on the debt"],
]);
// Holding a seat back must never cost the round a conversation that was actually available.
if (tiers && !tiers.includes("const standing = queue.filter(")) failures.push("services/speed-networking/speedNetworkingTiers.ts missing: the leftover repair pass");

// 4. The debt is CUMULATIVE and per round. Clearing it on being matched turns it back into "did
//    you sit out last round", which is the defect; counting it per read charges an attendee for
//    polling; pruning it to who is waiting right now throws it away the moment they are paired.
check("services/speed-networking/speedNetworkingService.ts", [
  'entries.filter((entry) => entry.status === "waiting" || entry.status === "matched")',
  "if (created.length) {",
  "for (const candidate of plan.unmatched) satOutCounts[candidate.attendeeId] = (satOutCounts[candidate.attendeeId] || 0) + 1;",
  "priorityAttendeeIds: plan.unmatched.filter(",
]);
refuse("services/speed-networking/speedNetworkingService.ts", [
  ["delete satOutCounts[", "the sit-out debt must survive being matched, or the same people take every sit-out"],
]);

// 5. The setup beat PR #65 landed is untouched by all of this: the pair is still decided a beat
//    before the room opens, and the round is still one batch tick.
check("services/speed-networking/speedNetworkingService.ts", [
  "const startsAt = new Date(nowMs + SPEED_NETWORKING_CYCLE.setupGapSeconds * 1_000);",
  "export async function startNetworkingMatchNow",
  "export function matchIsInSetup",
]);

// 6. The proof itself: the simulation exists, covers every tier, and asserts the distribution
//    rather than a single round.
check("tests/unit/speedNetworkingFairness.test.ts", [
  "for (const people of [3, 5, 7, 9, 12, 13, 51])",
  "spreads the sit-outs to within one over ${ROUNDS} rounds",
  "never sits the same person out twice running with ${people} waiting",
  "does not charge a sit-out for a poll that seated nobody",
  "carries the sit-out debt through a match rather than clearing it",
  "seats the most-owed attendee in the scored tier",
  "seats the most-owed attendee in the weighted-random tier",
  "tells the people a round left out that they are next",
]);
check("docs/manual-notes/networking-fairness.md", ["sit-out", "spread", "simultaneous"]);

// 7. And it is RUN, not merely present. A contract validator that only reads source would pass on
//    a matcher that had every one of these lines and still rotated badly.
const rounds = spawnSync("npx", ["vitest", "run", "tests/unit/speedNetworkingFairness.test.ts"], { encoding: "utf8", env: { ...process.env, VITE_CJS_IGNORE_WARNING: "true", NO_COLOR: "1", FORCE_COLOR: "0" } });
// CI runs vitest with colour on, and the summary line then carries ANSI codes this match cannot see.
// Strip them rather than trusting the environment to stay quiet.
const output = `${rounds.stdout || ""}${rounds.stderr || ""}`.replace(/\u001b\[[0-9;]*m/g, "");
const passed = /Tests {2}(\d+) passed \(\1\)/.exec(output);
if (rounds.status !== 0 || !passed) {
  failures.push(`the simultaneous-join simulation did not pass:\n${output.split("\n").slice(-30).join("\n")}`);
} else {
  examined += Number(passed[1]);
}

// Rule 0: a validator that examined nothing has not validated anything.
if (examined < 12) failures.push(`validate_speed_networking_fairness_contract examined only ${examined} files and assertions; it must read every file it governs and run the simulation.`);

if (failures.length) {
  console.error("validate_speed_networking_fairness_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`validate_speed_networking_fairness_contract: PASS — ${examined} files and simulated assertions; a room that joined at the same instant rotates its sit-outs to within one at every tier, nobody sits out twice running, and the debt survives a match but not a poll.`);
