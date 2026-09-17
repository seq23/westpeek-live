#!/usr/bin/env node
/**
 * Turn the Supabase GitHub integration's own verdict into an exit code.
 *
 * The integration applies supabase/migrations/ to the production project on every push to main and
 * reports the result as its own "Supabase Preview" check run. On 16 Sep 2026 it went RED twice —
 * `relation "public.request_event_intake" does not exist` on commits cf50aff and 78f6847 — and
 * nobody saw it, because a check run on a push to main appears on no pull request, in no workflow
 * run, and in no notification. Three migrations sat unapplied in production for days behind that
 * silence, and each was eventually found by accident.
 *
 * This is the part that was missing: a place the red surfaces. The workflow runs it on every push to
 * main, so the outcome lands in the Actions tab and the failure email.
 *
 *   node scripts/supabase_apply_verdict.js --sha <sha> [--changed-migrations true|false]
 *   node scripts/supabase_apply_verdict.js --verdict failure --changed-migrations true   (no network)
 *
 * The second form is how the rule proves itself: the workflow replays every terminal state on each
 * pull request, so the branch that decides red from green can never rot unnoticed.
 */
const { execFileSync } = require("node:child_process");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const repo = process.env.GITHUB_REPOSITORY || "seq23/westpeek-live";
const sha = arg("sha", process.env.GITHUB_SHA);
const changedMigrations = String(arg("changed-migrations", "false")) === "true";
const forced = arg("verdict", "");
/** Poll, because the integration starts when it starts. Every terminal state is matched, success and
 *  failure alike, so a crash can never read as "still running" and hang the job to its timeout. */
const attempts = Number(arg("attempts", "40"));
const waitMs = Number(arg("wait-ms", "15000")) || 0;

function readCheckRun() {
  const json = execFileSync("gh", ["api", `repos/${repo}/commits/${sha}/check-runs`, "--jq", '[.check_runs[] | select(.app.slug=="supabase")] | sort_by(.started_at) | last // empty'], { encoding: "utf8" }).trim();
  return json ? JSON.parse(json) : undefined;
}

function sleep(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function resolveVerdict() {
  if (forced) return { conclusion: forced, summary: `(replayed: --verdict ${forced})` };
  if (!sha) return { conclusion: "", summary: "no commit sha given" };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let run;
    try { run = readCheckRun(); } catch (error) { return { conclusion: "", summary: `could not read check runs: ${error instanceof Error ? error.message : String(error)}` }; }
    if (run && run.status === "completed") return { conclusion: run.conclusion || "unknown", summary: (run.output && run.output.summary) || "" };
    sleep(waitMs);
  }
  return { conclusion: "", summary: "the Supabase check run never completed" };
}

const { conclusion, summary } = resolveVerdict();
const label = conclusion || "<nothing reported>";
console.log(`Supabase check run for ${sha || "(replay)"}: ${label}`);
if (summary) console.log(summary);

if (conclusion === "success" || conclusion === "neutral") {
  console.log("Supabase applied supabase/migrations/ to the production project.");
  process.exit(0);
}
if (["failure", "timed_out", "cancelled", "action_required", "stale"].includes(conclusion)) {
  console.error(`::error title=Supabase did not apply the migrations::The Supabase integration reported '${conclusion}' for this commit. The production database is now BEHIND supabase/migrations/. Paste the failing file into the Supabase SQL editor for project lqxzpwtvolojashknseb, then re-run. See docs/manual-notes/migration-assurance.md.`);
  process.exit(1);
}
if (conclusion === "skipped" || conclusion === "") {
  if (changedMigrations) {
    console.error(`::error title=Supabase never applied this migration::This push changed supabase/migrations/ but the Supabase integration reported '${label}', so the SQL did not run. Apply it by hand in the Supabase SQL editor — docs/manual-notes/migration-assurance.md.`);
    process.exit(1);
  }
  console.log(`No migration changed in this push and Supabase reported '${label}'; nothing to apply.`);
  process.exit(0);
}
console.error(`::error title=Unrecognised Supabase conclusion::'${conclusion}' — treat as not applied until a person confirms otherwise.`);
process.exit(1);
