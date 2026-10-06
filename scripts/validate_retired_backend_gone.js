#!/usr/bin/env node
/**
 * Supabase is gone (6 Oct 2026: the free project was deleted and the app moved to D1 + R2 + an
 * app-owned login). Nothing that runs, builds, deploys or configures the app may name it again: not
 * code, not a script, not a workflow, not an env file, not the env contract, not a dependency. A
 * stray SUPABASE_* name in a manifest is a Worker secret someone will set for nothing; a stray client
 * import is a dead network call on a show day.
 *
 * Scope: every tracked file under app/ components/ lib/ services/ types/ scripts/ migrations-d1/
 * deployment/ data/ config/ .github/, plus middleware.ts, package.json, package-lock.json,
 * wrangler.jsonc, playwright.config.ts, every .env*.example and every root _*.json contract, and
 * SUPABASE_* env names anywhere in docs (history may say "Supabase"; it may not hand anyone a variable
 * to set). docs/SUPABASE_TO_CLOUDFLARE.md is the migration record and the one doc allowed the names;
 * docs/archive/ is superseded history and is not scanned.
 *
 * The one mention allowed in scope is the path of that record (docs/SUPABASE_TO_CLOUDFLARE.md), so a
 * comment can point a reader at the history without restating it.
 *
 * Hard-fails when it scans zero files.
 *
 *   node scripts/validate_retired_backend_gone.js              validate the repo
 *   node scripts/validate_retired_backend_gone.js --self-test  prove a planted reference fails and a clean tree passes
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SELF = "scripts/validate_retired_backend_gone.js";
const DIRS = ["app", "components", "lib", "services", "types", "scripts", "migrations-d1", "deployment", "data", "config", ".github"];
const ROOT_FILES = [/^middleware\.ts$/, /^package(-lock)?\.json$/, /^wrangler\.jsonc$/, /^playwright\.config\.ts$/, /^\.env[^/]*\.example$/, /^_[^/]+\.json$/];
const DOC_ALLOWED = new Set(["docs/SUPABASE_TO_CLOUDFLARE.md"]);
/** docs/archive/ is superseded history by definition: kept, never followed. */
const DOC_ARCHIVE = "docs/archive/";
const WORD = /supabase/i;
// The variables the Supabase era actually read. Doc FILE names (SUPABASE_SETUP.md) are history, not settings.
const ENV_NAME = /\b(?:NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_PROOF_TABLE|SUPABASE_PLAN|TIER4_SUPABASE_PROOF_TABLE)\b/;

function trackedFiles(root) {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean);
  } catch {
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const rel = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(rel);
        else out.push(rel);
      }
    };
    walk("");
    return out;
  }
}

function inScope(file) {
  if (file === SELF) return false;
  if (DIRS.some((dir) => file.startsWith(`${dir}/`))) return true;
  return !file.includes("/") && ROOT_FILES.some((pattern) => pattern.test(file));
}

function validate(root) {
  const failures = [];
  let scanned = 0;
  let docsScanned = 0;
  for (const file of trackedFiles(root)) {
    const full = path.join(root, file);
    if (!fs.existsSync(full) || fs.statSync(full).size > 5_000_000) continue;
    if (inScope(file)) {
      scanned += 1;
      // The one allowed mention is a pointer to the migration record itself.
      const text = fs.readFileSync(full, "utf8").replace(/docs\/SUPABASE_TO_CLOUDFLARE\.md/g, "docs/<migration record>");
      if (WORD.test(text)) {
        const line = text.split("\n").findIndex((l) => WORD.test(l)) + 1;
        failures.push(`${file}:${line} names Supabase`);
      }
    } else if (file.endsWith(".md") && !DOC_ALLOWED.has(file) && !file.startsWith(DOC_ARCHIVE)) {
      docsScanned += 1;
      const text = fs.readFileSync(full, "utf8");
      const match = ENV_NAME.exec(text);
      if (match) failures.push(`${file} names the env variable ${match[0]}; it no longer exists`);
    }
  }
  if (!scanned) failures.push("scanned zero files; the scope is broken");
  return { failures, scanned, docsScanned };
}

function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "no-supabase-"));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  write("lib/clean.ts", "export const store = 'd1';\n");
  write("package.json", "{\"name\":\"x\"}\n");
  write("docs/history.md", "We moved off a hosted Postgres.\n");
  const clean = validate(dir);
  const cases = [
    ["a client import in code", () => write("lib/db.ts", 'import { createClient } from "@supabase/supabase-js";\n'), /lib\/db\.ts:1 names Supabase/],
    ["a dependency", () => write("package.json", "{\"dependencies\":{\"@supabase/supabase-js\":\"2\"}}\n"), /package\.json:1 names Supabase/],
    ["an env name in a doc", () => write("docs/setup.md", "Set SUPABASE_SERVICE_ROLE_KEY first.\n"), /SUPABASE_SERVICE_ROLE_KEY/],
    ["a workflow", () => write(".github/workflows/keep.yml", "name: Supabase keep-alive\n"), /keep\.yml:1 names Supabase/],
  ];
  let failed = clean.failures.length ? 1 : 0;
  if (failed) console.error(`self-test: the clean tree failed: ${clean.failures[0]}`);
  for (const [name, plant, expected] of cases) {
    plant();
    const hit = validate(dir).failures.some((f) => expected.test(f));
    console.log(`self-test ${hit ? "PASS" : "FAIL"}: ${name} ${hit ? "is caught" : "was NOT caught"}`);
    if (!hit) failed += 1;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  if (failed) { console.error(`validate_retired_backend_gone --self-test: FAIL (${failed})`); return 1; }
  console.log(`validate_retired_backend_gone --self-test: PASS — ${cases.length} planted references caught, clean tree passes`);
  return 0;
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) process.exit(selfTest());
  const result = validate(path.resolve(__dirname, ".."));
  if (result.failures.length) {
    console.error(`validate_retired_backend_gone: FAIL (${result.failures.length})`);
    for (const failure of result.failures.slice(0, 60)) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`validate_retired_backend_gone: PASS — ${result.scanned} files that run, build, deploy or configure the app and ${result.docsScanned} docs scanned; none names Supabase.`);
}

module.exports = { validate };
