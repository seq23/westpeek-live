#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const reportPath = path.join(reportsDir, "local-visual-proof-recovery.md");
const isWindows = process.platform === "win32";
const playwrightBin = path.join(root, "node_modules", ".bin", isWindows ? "playwright.cmd" : "playwright");
const playwrightCommand = fs.existsSync(playwrightBin) ? playwrightBin : isWindows ? "npx.cmd" : "npx";

const basePlaywrightArgs = fs.existsSync(playwrightBin)
  ? ["test"]
  : ["playwright", "test"];

const projects = ["desktop-chromium", "mobile-chromium"];
const timeoutMs = process.env.LOCAL_VISUAL_PROOF_TIMEOUT || "90000";

function withLocalProofEnv() {
  return {
    ...process.env,
    NODE_OPTIONS: "--max-old-space-size=4096 --dns-result-order=ipv4first",
    PLAYWRIGHT_EVIDENCE_MODE: "1",
    PLAYWRIGHT_DISABLE_VIDEO: "1",
    PLAYWRIGHT_HEADED: "1",
  };
}

function runProject(project) {
  const args = [
    ...basePlaywrightArgs,
    `--project=${project}`,
    "--workers=1",
    `--timeout=${timeoutMs}`,
  ];

  console.log(`\n==> Local visual proof: ${project}`);
  console.log(`==> Command: ${playwrightCommand} ${args.join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(playwrightCommand, args, {
      cwd: root,
      env: withLocalProofEnv(),
      shell: false,
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("close", (code, signal) => {
      resolve({ project, code: code ?? 1, signal, output });
    });
    child.on("error", (error) => {
      const text = `\nFAILED TO START ${project}: ${error.message}\n`;
      output += text;
      process.stderr.write(text);
      resolve({ project, code: 1, signal: null, output });
    });
  });
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    // One isolation command per failed spec file is enough and avoids duplicate
    // commands when Playwright reports the same failed test in both progress and
    // summary sections with slightly different duration suffixes.
    const key = `${item.project}::${item.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseFailedTests(output, fallbackProject) {
  // FAILED-SPEC-ONLY CONTRACT:
  // Do not parse every Playwright progress line. Passing test lines contain the same
  // "[project] › tests/e2e/..." shape as failures, so broad regexes create noisy,
  // unusable recovery reports. This parser intentionally reads only failed-test
  // summary sections and red-X progress lines.
  const failed = [];
  let match;

  const failureHeaderPattern = /^\s+\d+\)\s+\[(desktop-chromium|mobile-chromium)\]\s+›\s+(tests\/e2e\/[^:\n]+\.spec\.ts):\d+:\d+\s+›\s+([^\n]+)$/gm;
  while ((match = failureHeaderPattern.exec(output)) !== null) {
    failed.push({ project: match[1], file: match[2], title: match[3].trim() });
  }

  const runningFailurePattern = /^\s*[✘x]\s+\d+\s+\[(desktop-chromium|mobile-chromium)\]\s+›\s+(tests\/e2e\/[^:\n]+\.spec\.ts):\d+:\d+\s+›\s+([^\n]+)$/gm;
  while ((match = runningFailurePattern.exec(output)) !== null) {
    failed.push({ project: match[1], file: match[2], title: match[3].trim() });
  }

  const failedSummaryBlock = output.match(/\n\s+\d+ failed[\s\S]*?(?:\n\s+\d+ skipped|\n\s+\d+ passed|\nTo open last HTML report|$)/)?.[0] || "";
  const failedSummaryPattern = /^\s+\[(desktop-chromium|mobile-chromium)\]\s+›\s+(tests\/e2e\/[^:\n]+\.spec\.ts):\d+:\d+\s+›\s+([^\n]+)$/gm;
  while ((match = failedSummaryPattern.exec(failedSummaryBlock)) !== null) {
    failed.push({ project: match[1], file: match[2], title: match[3].trim() });
  }

  if (!failed.length) {
    const stackFailurePattern = /at [^\n]*(tests\/e2e\/[^:\n]+\.spec\.ts):\d+:\d+/g;
    while ((match = stackFailurePattern.exec(output)) !== null) {
      failed.push({ project: fallbackProject, file: match[1], title: "Unparsed Playwright failure" });
    }
  }

  return dedupe(failed);
}

function classifyFailure(output) {
  const harnessSignals = [
    "Server is approaching the used memory threshold",
    "ERR_CONNECTION_REFUSED",
    "ERR_ABORTED",
    "ERR_EMPTY_RESPONSE",
    "ERR_INCOMPLETE_CHUNKED_ENCODING",
    "maybe frame was detached",
    "Test timeout",
    "net::ERR_CONNECTION_REFUSED",
    "net::ERR_ABORTED",
    "Fast Refresh had to perform a full reload",
  ];
  const found = harnessSignals.filter((signal) => output.includes(signal));
  return {
    classification: found.length
      ? "LOCAL HARNESS / NEXT DEV RESTART / TIMEOUT SUSPECTED — NOT CONFIRMED PRODUCT DEFECT"
      : "BROWSER PROOF FAILED — PRODUCT DEFECT POSSIBLE UNTIL ISOLATION PASSES",
    signals: found,
  };
}

function isolationCommand(test) {
  return [
    'cd "/Users/sequoiataylor/Documents/GitHub/agency-event-os"',
    `PATH="/opt/homebrew/opt/node@22/bin:$PATH" NODE_OPTIONS="--max-old-space-size=4096 --dns-result-order=ipv4first" PLAYWRIGHT_EVIDENCE_MODE=1 PLAYWRIGHT_DISABLE_VIDEO=1 PLAYWRIGHT_HEADED=1 npx playwright test ${test.file} --project=${test.project} --headed --workers=1 --timeout=90000 --reporter=line`,
  ].join("\n");
}

function writeRecoveryReport(result) {
  const failedTests = parseFailedTests(result.output, result.project);
  const classification = classifyFailure(result.output);
  const lines = [];
  lines.push("# Local Visual Proof Recovery");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Failed project: ${result.project}`);
  lines.push(`Exit code: ${result.code}`);
  if (result.signal) lines.push(`Signal: ${result.signal}`);
  lines.push(`Classification: ${classification.classification}`);
  if (classification.signals.length) {
    lines.push(`Signals: ${classification.signals.join(", ")}`);
  }
  lines.push("");
  lines.push("## What this means");
  lines.push("");
  if (classification.signals.length) {
    lines.push("The full headed Playwright suite can fail when Next dev restarts or cold-compiles routes under memory pressure. That is not automatically a product defect. Treat it as a harness failure until the isolated failed test also fails.");
  } else {
    lines.push("No clear harness/restart signal was detected. Treat the failed test as a possible product defect unless the isolated command passes cleanly.");
  }
  lines.push("");
  lines.push("## Isolation commands");
  lines.push("");
  if (failedTests.length) {
    failedTests.forEach((test, index) => {
      lines.push(`### ${index + 1}. ${test.project} — ${test.file}`);
      lines.push("");
      lines.push("```bash");
      lines.push(isolationCommand(test));
      lines.push("```");
      lines.push("");
    });
  } else {
    lines.push("No specific test file was parsed. Re-run the failed project directly:");
    lines.push("");
    lines.push("```bash");
    lines.push('cd "/Users/sequoiataylor/Documents/GitHub/agency-event-os"');
    lines.push(`PATH="/opt/homebrew/opt/node@22/bin:$PATH" NODE_OPTIONS="--max-old-space-size=4096 --dns-result-order=ipv4first" PLAYWRIGHT_EVIDENCE_MODE=1 PLAYWRIGHT_DISABLE_VIDEO=1 PLAYWRIGHT_HEADED=1 npx playwright test --project=${result.project} --headed --workers=1 --timeout=90000 --reporter=line`);
    lines.push("```");
    lines.push("");
  }
  lines.push("## Commit / push decision");
  lines.push("");
  lines.push("Only use this path when all of these are true:");
  lines.push("");
  lines.push("1. `npm run validate` passed in the same updater run.");
  lines.push("2. `npm run validate:lifecycle-governance` passed in the same updater run.");
  lines.push("3. The failed browser test passes with the isolation command above.");
  lines.push("");
  lines.push("Then commit and push the preserved updater-applied working tree:");
  lines.push("");
  lines.push("```bash");
  lines.push('cd "/Users/sequoiataylor/Documents/GitHub/agency-event-os"');
  lines.push("git status --short");
  lines.push("git add -A");
  lines.push('git commit -m "snapshot update from baseline ZIP"');
  lines.push("git push origin main");
  lines.push("```");
  lines.push("");
  lines.push("If the isolated command fails again with the same assertion or route behavior, do not push. Fix the product defect and deliver a new full baseline ZIP.");
  lines.push("");

  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(reportPath, lines.join("\n"));

  console.error("\n============================================================");
  console.error("LOCAL VISUAL PROOF FAILED");
  console.error(`CLASSIFICATION: ${classification.classification}`);
  if (classification.signals.length) console.error(`SIGNALS: ${classification.signals.join(", ")}`);
  console.error(`RECOVERY REPORT: ${reportPath}`);
  console.error("============================================================\n");
  console.error(lines.join("\n"));
}

const results = [];
for (const project of projects) {
  const result = await runProject(project);
  results.push(result);
  if (result.code !== 0) {
    writeRecoveryReport(result);
    process.exit(result.code);
  }
}

console.log("\nLOCAL VISUAL PROOF: PASS", JSON.stringify(results.map((result) => ({ project: result.project, code: result.code }))));
