const fs = require("fs");

function fail(message) {
  console.error("validate_runtime_audit_contract: FAIL — " + message);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail("missing " + file);
  return fs.readFileSync(file, "utf8");
}

const requiredFiles = [
  "playwright.config.ts",
  "tests/e2e/public-frontdoor.spec.ts",
  "tests/e2e/production-access.spec.ts",
  "tests/e2e/demo-venue-clickthrough.spec.ts",
  "tests/e2e/video-provider-safe-failure.spec.ts",
  "tests/e2e/speed-networking.spec.ts",
  "tests/e2e/role-gates.spec.ts",
  "tests/e2e/registration-profile.spec.ts",
  "tests/e2e/people-profile.spec.ts",
  "tests/e2e/helpers/assertNoAppError.ts",
  "tests/e2e/helpers/roleJourney.ts",
  "tests/e2e/visitor-full-journey.spec.ts",
  "tests/e2e/attendee-full-journey.spec.ts",
  "tests/e2e/role-surfaces-full-journey.spec.ts",
  "tests/e2e/producer-admin-full-journey.spec.ts",
  "tests/e2e/crew-testing-console-full-journey.spec.ts",
  "tests/e2e/access-safe-failure-full-journey.spec.ts",
  "tests/e2e/transactional-full-buffett.spec.ts",
  "tests/e2e/helpers/runtimeTrace.ts",
  "scripts/audit_cloudflare_secret_parity.js",
  "scripts/post_deploy_role_flow_e2e_audit.js",
  "scripts/audit_speed_networking_e2e.js",
];
for (const file of requiredFiles) read(file);

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};
for (const key of ["test:e2e", "postdeploy:browser", "test:e2e:deployed", "audit:cloudflare-secrets", "postdeploy:role-flow-e2e", "audit:speed-networking:e2e", "test:e2e:transactional"]) {
  if (!scripts[key]) fail(`package.json missing ${key}`);
}
const full = scripts["postdeploy:full"] || "";
const strictWrapper = "scripts/run_postdeploy_strict.js";

if (!full) {
  fail("package.json missing postdeploy:full");
}

if (full.includes(strictWrapper)) {
  const strictBody = read(strictWrapper);
  if (!strictBody.includes("postdeploy:browser")) {
    fail("strict postdeploy wrapper must include browser E2E audit");
  }
} else if (!full.includes("postdeploy:browser")) {
  fail("postdeploy:full must include browser E2E audit or use strict wrapper");
}
if (!scripts["validate:deploy-parity"] || !scripts["validate:deploy-parity"].includes("validate_runtime_audit_contract.js")) {
  fail("validate:deploy-parity must include validate_runtime_audit_contract.js");
}

const pw = read("playwright.config.ts");
for (const term of ["PLAYWRIGHT_BASE_URL", "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", "PLAYWRIGHT_DISABLE_VIDEO", "--headless=new", "chromium"]) {
  if (!pw.includes(term)) fail(`playwright.config.ts missing ${term}`);
}

const registry = JSON.parse(read("deployment/env-var-registry.json"));
const classified = new Set([...(registry.requiredProductionEnv || []), ...(registry.cloudflareSecretKeys || []), ...(registry.localOnlyEnv || []), ...(registry.internalRuntimeEnv || []), ...(registry.optionalDevEnv || [])]);
for (const key of ["PLAYWRIGHT_BASE_URL", "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", "PLAYWRIGHT_DISABLE_VIDEO", "PLAYWRIGHT_HEADED", "PLAYWRIGHT_RETRIES", "CLOUDFLARE_WORKER_NAME", "CI", "PATH"]) {
  if (!classified.has(key)) fail(`${key} must be classified in deployment/env-var-registry.json`);
}
console.log("validate_runtime_audit_contract: PASS");
