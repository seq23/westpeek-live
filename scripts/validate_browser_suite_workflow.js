#!/usr/bin/env node
/**
 * The browser suite runs, and runs where it should (6 Oct 2026). Before this there was no browser
 * workflow at all: the Playwright suite had drifted until 46 of its tests failed on pages nobody
 * had broken, and nothing noticed. The rules, each checked here:
 *
 *  - .github/workflows/browser-e2e.yml exists and runs `npx playwright test`;
 *  - it runs after merge, not as a merge gate: push to main + a nightly schedule + workflow_dispatch,
 *    and never on pull_request (the merge gate is "Repository validation", which must stay fast and
 *    must not run Playwright itself);
 *  - its job has a timeout-minutes between 10 and 120 (a fault detector at ~4x a normal run);
 *  - a red run opens or updates the browser-suite-red issue, and a green run closes it;
 *  - playwright.config.ts serves the suite from a production build (`next build` + `next start`),
 *    never `next dev`, on localhost (the host `next start` redirects to), from an emptied runtime
 *    store.
 *
 * Hard-fails when it checks nothing.
 *
 *   node scripts/validate_browser_suite_workflow.js              validate the repo
 *   node scripts/validate_browser_suite_workflow.js --self-test  prove each planted break fails and the real tree passes
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const YAML = require("yaml");

const WORKFLOW = ".github/workflows/browser-e2e.yml";
const MERGE_GATE = ".github/workflows/validation.yml";
const CONFIG = "playwright.config.ts";

function validate(root) {
  const failures = [];
  let checks = 0;
  const check = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
  const read = (file) => { const full = path.join(root, file); return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : undefined; };

  const workflowText = read(WORKFLOW);
  check(Boolean(workflowText), `${WORKFLOW} is missing: nothing runs the browser suite`);
  if (workflowText) {
    let workflow;
    try { workflow = YAML.parse(workflowText); } catch (error) { failures.push(`${WORKFLOW} does not parse: ${error.message}`); }
    if (workflow) {
      const on = workflow.on || workflow[true] || {};
      check(Array.isArray(on.push?.branches) && on.push.branches.includes("main"), `${WORKFLOW} must run on push to main`);
      check(Array.isArray(on.schedule) && on.schedule.some((entry) => typeof entry.cron === "string" && entry.cron.trim()), `${WORKFLOW} must run on a nightly schedule`);
      check(Object.prototype.hasOwnProperty.call(on, "workflow_dispatch"), `${WORKFLOW} must be dispatchable by hand`);
      check(!Object.prototype.hasOwnProperty.call(on, "pull_request") && !Object.prototype.hasOwnProperty.call(on, "pull_request_target"), `${WORKFLOW} must not run on pull requests: the browser suite is post-merge, never the merge gate`);
      const jobs = Object.values(workflow.jobs || {});
      check(jobs.length > 0, `${WORKFLOW} has no jobs`);
      for (const job of jobs) {
        const minutes = job["timeout-minutes"];
        check(Number.isInteger(minutes) && minutes >= 10 && minutes <= 120, `${WORKFLOW}: every job needs timeout-minutes between 10 and 120 (got ${minutes})`);
      }
      const runs = jobs.flatMap((job) => (job.steps || []).map((step) => ({ run: String(step.run || ""), if: String(step.if || "") })));
      check(runs.some((step) => /\bnpx playwright test\b/.test(step.run) && !step.if), `${WORKFLOW} must run \`npx playwright test\` unconditionally`);
      check(runs.some((step) => /failure\(\)/.test(step.if) && /gh issue create/.test(step.run) && /gh issue comment/.test(step.run) && /browser-suite-red/.test(step.run)), `${WORKFLOW} must open or update the browser-suite-red issue on failure`);
      check(runs.some((step) => /success\(\)/.test(step.if) && /gh issue close/.test(step.run) && /browser-suite-red/.test(step.run)), `${WORKFLOW} must close the browser-suite-red issue on success`);
    }
  }

  const gate = read(MERGE_GATE);
  check(Boolean(gate), `${MERGE_GATE} is missing`);
  if (gate) check(!/playwright test|test:e2e/.test(gate), `${MERGE_GATE} is the fast merge gate and must not run the browser suite`);

  const config = read(CONFIG);
  check(Boolean(config), `${CONFIG} is missing`);
  if (config) {
    // The webServer command line itself, not the comments around it.
    const command = (config.match(/^\s*command:\s*`([^`]*)`/m) || [])[1] || "";
    check(Boolean(command), `${CONFIG} has no webServer command`);
    check(/next build/.test(command) && /next start/.test(command), `${CONFIG} must serve the suite from a production build (next build + next start)`);
    check(!/npm run dev|next dev/.test(command), `${CONFIG} must not serve the suite from next dev (per-route compiles timed tests out)`);
    check(/"http:\/\/localhost:3000"/.test(config) && /--hostname localhost/.test(command), `${CONFIG} must browse and serve on localhost`);
    check(/rmSync\(process\.argv\[1\]/.test(command), `${CONFIG} must start every server from an emptied runtime store`);
  }

  if (!checks) failures.push("checked nothing");
  return { failures, checks };
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "browser-suite-workflow-"));
  const copy = (file) => { fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true }); fs.copyFileSync(file, path.join(tmp, file)); };
  const reset = () => { for (const file of [WORKFLOW, MERGE_GATE, CONFIG]) copy(file); };
  const edit = (file, from, to) => { const full = path.join(tmp, file); const text = fs.readFileSync(full, "utf8"); if (!from.test(text)) throw new Error(`self-test cannot plant into ${file}: ${from}`); fs.writeFileSync(full, text.replace(from, to)); };
  const cases = [
    ["a pull_request trigger", () => edit(WORKFLOW, /\non:\n/, "\non:\n  pull_request:\n"), /must not run on pull requests/],
    ["no schedule", () => edit(WORKFLOW, /  schedule:\n.*\n.*\n/, ""), /nightly schedule/],
    ["no timeout", () => edit(WORKFLOW, /    timeout-minutes: \d+\n/, ""), /timeout-minutes between 10 and 120/],
    ["no failure issue", () => edit(WORKFLOW, /gh issue create/, "echo"), /browser-suite-red issue on failure/],
    ["the gate runs playwright", () => edit(MERGE_GATE, /- run: npm ci\n/, "- run: npm ci\n      - run: npx playwright test\n"), /fast merge gate/],
    ["next dev in the config", () => edit(CONFIG, /npx next build && npx next start/, "npm run dev --"), /production build/],
    ["the workflow is gone", () => fs.rmSync(path.join(tmp, WORKFLOW)), /is missing: nothing runs the browser suite/],
  ];
  let failed = 0;
  reset();
  const clean = validate(tmp);
  if (clean.failures.length) { console.error("SELF-TEST: the real tree fails:", clean.failures); failed += 1; }
  for (const [name, plant, expected] of cases) {
    reset(); plant();
    const result = validate(tmp);
    if (!result.failures.some((failure) => expected.test(failure))) { console.error(`SELF-TEST: planting ${name} was not caught (${JSON.stringify(result.failures)})`); failed += 1; }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) process.exit(1);
  console.log(`BROWSER SUITE WORKFLOW SELF-TEST: PASS (${cases.length} planted breaks caught, real tree clean)`);
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const { failures, checks } = validate(process.cwd());
  if (failures.length) { for (const failure of failures) console.error(`BROWSER SUITE WORKFLOW: ${failure}`); process.exit(1); }
  console.log(`BROWSER SUITE WORKFLOW: PASS (${checks} checks)`);
}
