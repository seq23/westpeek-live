const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const forbiddenTrackedSecretFiles = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.backup",
  ".env.local.backup",
  "cloudflare-secrets.json"
];

let trackedFiles = [];
try {
  trackedFiles = execSync("git ls-files", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/).filter(Boolean);
} catch {
  trackedFiles = [];
}

for (const target of forbiddenTrackedSecretFiles) {
  if (trackedFiles.includes(target)) {
    throw new Error(`Forbidden secret file is tracked by git: ${target}`);
  }
}

const allowedEnvExampleFiles = new Set([
  ".env.example",
  ".env.local.example",
  ".env.preview.example",
  ".env.production.example",
  ".env.local"
]);

const skippedFiles = new Set([
  "scripts/validate_v5_no_secrets.js",
  "scripts/import_event_config_package.js",
  "scripts/validate_event_config_package.js"
]);

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  ".next",
  ".open-next",
  ".wrangler",
  ".runtime-data",
  "coverage",
  "dist",
  "build",
  "out",
  "playwright-report",
  "test-results",
  "logs"
]);

const hardFailSecretPatterns = [
  /sk_live_[A-Za-z0-9]/i,
  /-----BEGIN PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/
];

const sourceSecretPatterns = [
  /CLOUDFLARE_API_TOKEN[ \t]*=[ \t]*[^\n#]+/,
  /RESEND_API_KEY[ \t]*=[ \t]*[^\n#]+/,
  /LIVEKIT_API_SECRET[ \t]*=[ \t]*[^\n#]+/,
  /CLOUDFLARE_API_TOKEN[ \t]*=[ \t]*[^\n#]+/
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const full = path.join(dir, entry.name);
    const rel = path.relative(process.cwd(), full).replaceAll(path.sep, "/");

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!entry.isFile()) continue;
    if (skippedFiles.has(rel)) continue;

    const body = fs.readFileSync(full, "utf8");

    for (const pattern of hardFailSecretPatterns) {
      if (pattern.test(body)) throw new Error(`High-risk secret-like value found in ${rel}`);
    }

    for (const pattern of sourceSecretPatterns) {
      if (pattern.test(body) && !allowedEnvExampleFiles.has(rel)) {
        throw new Error(`Server-secret-like assignment found in source file ${rel}`);
      }
    }
  }
}

walk(".");
console.log("validate_v5_no_secrets: PASS");
