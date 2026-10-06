#!/usr/bin/env node
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { day1Default } = require('./lib/day1AccessDefaults');

const root = process.cwd();
const cli = path.join(root, "node_modules", "@playwright", "test", "cli.js");

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  return true;
}

const args = process.argv.slice(2);
const suite = args[0] && !args[0].startsWith("-") ? args.shift() : "all";
const passThroughArgs = args;
const suiteMap = {
  surface: ["tests/e2e/public-frontdoor.spec.ts", "tests/e2e/visitor-full-journey.spec.ts"],
  transactional: ["tests/e2e/transactional-full-buffett.spec.ts", "tests/e2e/attendee-registration-outcome.spec.ts", "tests/e2e/attendee-venue-identity.spec.ts"],
  outcome: ["tests/e2e/persona-outcome-promises.spec.ts", "tests/e2e/access-boundary-outcomes.spec.ts", "tests/e2e/stream-failover-outcomes.spec.ts", "tests/e2e/attendee-live-participation-outcomes.spec.ts"],
  all: [],
};

if (!Object.prototype.hasOwnProperty.call(suiteMap, suite)) {
  console.error(`Unknown local E2E diagnostics suite: ${suite}`);
  console.error(`Allowed suites: ${Object.keys(suiteMap).join(", ")}`);
  process.exit(1);
}

const downloads = path.join(os.homedir(), "Downloads");
const diagnosticsName = `agency-event-os-e2e-diagnostics_${stamp()}`;
const diagnosticsDir = path.join(downloads, diagnosticsName);
const logsDir = path.join(diagnosticsDir, "logs");
const runtimeDir = path.join(diagnosticsDir, "runtime");
const testResultsDir = path.join(diagnosticsDir, "test-results");
const htmlReportDir = path.join(diagnosticsDir, "playwright-report");
const rawArtifactsDir = path.join(diagnosticsDir, "raw-artifacts");
const logPath = path.join(logsDir, "playwright-predeploy-headed.log");
const summaryPath = path.join(diagnosticsDir, "summary.json");
const zipPath = path.join(downloads, `${diagnosticsName}.zip`);

ensureDir(logsDir);
ensureDir(runtimeDir);
ensureDir(testResultsDir);
ensureDir(htmlReportDir);
ensureDir(rawArtifactsDir);

const port = process.env.PORT || "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const runtimePath = process.env.AGENCY_EVENT_OS_RUNTIME_STORE_PATH || path.join(runtimeDir, "local-playwright-runtime.json");

const safeEnv = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=3072",
  PLAYWRIGHT_BASE_URL: baseURL,
  PLAYWRIGHT_DEPLOYED: "0",
  PLAYWRIGHT_LOCAL_E2E: "1",
  LOCAL_PLAYWRIGHT_GAUNTLET_AUTH: "true",
  PLAYWRIGHT_HEADED: process.env.PLAYWRIGHT_HEADED || "1",
  PLAYWRIGHT_RETRIES: process.env.PLAYWRIGHT_RETRIES || "0",
  PLAYWRIGHT_DISABLE_VIDEO: process.env.PLAYWRIGHT_DISABLE_VIDEO || "0",
  PLAYWRIGHT_HTML_REPORT: htmlReportDir,
  NEXT_PUBLIC_APP_URL: baseURL,
  AGENCY_EVENT_OS_RUNTIME_STORE: "file",
  AGENCY_EVENT_OS_RUNTIME_STORE_PATH: runtimePath,
  ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION: "true",
  VIDEO_PROVIDER: "mock",
  ALLOW_MOCK_VIDEO_PROVIDER_IN_PRODUCTION: "true",
  DAILY_FALLBACK_ENABLED: "false",
  DAILY_STAGE_FALLBACK_REQUIRES_TOKEN: "true",
  STREAMYARD_PRIMARY_ENABLED: "true",
  STAGE_STREAM_DEFAULT_SOURCE: "LIVEKIT_INGRESS",
  V5_ACCESS_COOKIE_SECRET: day1Default("V5_ACCESS_COOKIE_SECRET", "local-playwright-e2e-cookie-secret-1234567890"),
  CREW_ACCESS_PASSWORD: day1Default('CREW_ACCESS_PASSWORD'),
  OPERATOR_LAUNCHPAD_PASSWORD: day1Default('OPERATOR_LAUNCHPAD_PASSWORD'),
  AUTH_SESSION_COOKIE_NAME: process.env.AUTH_SESSION_COOKIE_NAME || "agency_event_os_session",
  V5_CREW_COOKIE_NAME: process.env.V5_CREW_COOKIE_NAME || "wpl_crew_access",
  V5_OPERATOR_COOKIE_NAME: process.env.V5_OPERATOR_COOKIE_NAME || "wpl_operator_access",
  V5_SPECIAL_GUEST_COOKIE_NAME: process.env.V5_SPECIAL_GUEST_COOKIE_NAME || "wpl_guest_access",
  EVENT_DEMO_SPEAKER_CODE: day1Default('EVENT_DEMO_SPEAKER_CODE'),
  EVENT_DEMO_SPONSOR_CODE: day1Default('EVENT_DEMO_SPONSOR_CODE'),
  EVENT_DEMO_VIP_CODE: day1Default('EVENT_DEMO_VIP_CODE'),
  LIVEKIT_URL: "",
  LIVEKIT_API_KEY: "",
  LIVEKIT_API_SECRET: "",
  LIVEKIT_WEBHOOK_SECRET: "",
  DAILY_API_KEY: "",
  DAILY_DOMAIN: "",
};

const metadata = {
  createdAt: new Date().toISOString(),
  suite,
  root,
  baseURL,
  diagnosticsDir,
  zipPath,
  mode: "headed local predeploy diagnostics",
  guarantees: [
    "browser opens by default",
    "local Next dev server auto-starts through Playwright webServer",
    "file runtime store is isolated to the diagnostics folder",
    "database/provider secrets are blanked for local predeploy",
    "Playwright runs with --max-failures=0 so the run does not stop after the first failure",
    "diagnostics ZIP is written to ~/Downloads even when tests fail",
  ],
};
writeJson(path.join(diagnosticsDir, "metadata.json"), metadata);

if (!fs.existsSync(cli)) {
  const message = "PREDEPLOY E2E DIAGNOSTICS BLOCKED: node_modules/@playwright/test/cli.js is missing. Run npm ci, or copy a complete node_modules folder into this ZIP workspace, then rerun.";
  fs.writeFileSync(logPath, `${message}\n`, "utf8");
  writeJson(summaryPath, { ...metadata, status: "BLOCKED", exitCode: 1, blocker: message });
  makeZip();
  console.error(message);
  console.error(`Diagnostics ZIP: ${zipPath}`);
  process.exit(1);
}

const playwrightArgs = [
  cli,
  "test",
  ...suiteMap[suite],
  "--max-failures=0",
  `--output=${testResultsDir}`,
  ...passThroughArgs,
];

const commandForHumans = `node ${path.relative(root, cli)} ${playwrightArgs.slice(1).join(" ")}`;
const header = [
  "Agency Event OS headed local E2E diagnostics",
  `Suite: ${suite}`,
  `Base URL: ${baseURL}`,
  `Runtime store: ${runtimePath}`,
  `Diagnostics folder: ${diagnosticsDir}`,
  `Diagnostics ZIP: ${zipPath}`,
  "Mode: headed browser, local predeploy, file runtime, mock video, no database/provider secrets",
  `Command: ${commandForHumans}`,
  "",
].join("\n");
fs.appendFileSync(logPath, header, "utf8");
process.stdout.write(header);

let exitCode = 1;
const child = spawn(process.execPath, playwrightArgs, {
  cwd: root,
  env: safeEnv,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  fs.appendFileSync(logPath, chunk);
});
child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  fs.appendFileSync(logPath, chunk);
});

child.on("close", (code) => {
  exitCode = code ?? 1;
  finish(exitCode);
});
child.on("error", (error) => {
  fs.appendFileSync(logPath, `\nRUNNER ERROR: ${error.stack || error.message}\n`, "utf8");
  finish(1, error.message);
});

function finish(code, runnerError) {
  copyIfExists(path.join(root, "playwright-report"), path.join(rawArtifactsDir, "playwright-report-from-root"));
  copyIfExists(path.join(root, "test-results"), path.join(rawArtifactsDir, "test-results-from-root"));
  for (const file of ["package.json", "package-lock.json", "playwright.config.ts"]) {
    if (fs.existsSync(path.join(root, file))) {
      fs.copyFileSync(path.join(root, file), path.join(diagnosticsDir, file.replaceAll("/", "__")));
    }
  }
  writeJson(summaryPath, {
    ...metadata,
    status: code === 0 ? "PASS" : "FAIL",
    exitCode: code,
    runnerError: runnerError || null,
    logPath,
    testResultsDir,
    htmlReportDir,
  });
  makeZip();
  const footer = `\nE2E diagnostics complete. Status: ${code === 0 ? "PASS" : "FAIL"}. Diagnostics ZIP: ${zipPath}\n`;
  fs.appendFileSync(logPath, footer, "utf8");
  process.stdout.write(footer);
  process.exit(code);
}

function makeZip() {
  try {
    fs.rmSync(zipPath, { force: true });
    const result = spawnSync("zip", ["-qr", zipPath, path.basename(diagnosticsDir)], {
      cwd: path.dirname(diagnosticsDir),
      stdio: "ignore",
    });
    if (result.status !== 0) {
      const fallback = path.join(downloads, `${diagnosticsName}.tar.gz`);
      spawnSync("tar", ["-czf", fallback, path.basename(diagnosticsDir)], {
        cwd: path.dirname(diagnosticsDir),
        stdio: "ignore",
      });
    }
  } catch (error) {
    try {
      fs.writeFileSync(path.join(diagnosticsDir, "ZIP_CREATION_FAILED.txt"), String(error.stack || error.message), "utf8");
    } catch {}
  }
}
