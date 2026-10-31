// OpenNext refuses to build a Next.js major two years after its release, by today's clock: Next 15
// stopped building on 21 Oct 2026 with no commit behind it, and every preview and deploy went red.
// PR #91 forced it through with --dangerouslyUseUnsupportedNextVersion; the lasting fix moved the
// app to Next 16. This guard keeps it there: it fails if `next` (package.json AND package-lock.json)
// drops below major 16, or if the override flag reappears anywhere that builds or deploys the app.
// `--self-test` plants both defects in memory and proves each one fails.
import fs from "node:fs";
import path from "node:path";

const FLOOR = 16;
const FLAG = "dangerouslyUseUnsupportedNextVersion";
// Everything that can run the OpenNext build: package scripts, repo scripts, CI, Worker/OpenNext config.
const SCAN_ROOTS = ["package.json", "scripts", ".github", "open-next.config.ts", "wrangler.jsonc", "next.config.js"];
const SELF = path.normalize("scripts/validate_next_version_floor.mjs");

function major(spec) {
  const m = String(spec ?? "").match(/(\d+)\./);
  return m ? Number(m[1]) : NaN;
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  if (fs.statSync(root).isFile()) return [root];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(root, d.name);
    return d.isDirectory() ? listFiles(p) : [p];
  });
}

export function check({ pkg, lock, files }) {
  const errors = [];
  const declared = pkg.dependencies?.next ?? pkg.devDependencies?.next;
  if (!(major(declared) >= FLOOR)) errors.push(`package.json pins next "${declared}"; the floor is ${FLOOR} (OpenNext refuses older majors)`);
  const locked = lock?.packages?.["node_modules/next"]?.version;
  if (!(major(locked) >= FLOOR)) errors.push(`package-lock.json resolves next ${locked}; the floor is ${FLOOR}`);
  if (!files.length) errors.push("scanned no build/deploy files: the guard cannot see what it governs");
  for (const { file, text } of files) if (text.includes(FLAG)) errors.push(`${file} carries --${FLAG}; upgrade Next instead of forcing the build`);
  return { errors, declared, locked, scanned: files.length };
}

function readRepo() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = fs.existsSync("package-lock.json") ? JSON.parse(fs.readFileSync("package-lock.json", "utf8")) : null;
  const files = SCAN_ROOTS.flatMap(listFiles)
    .filter((f) => path.normalize(f) !== SELF)
    .map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
  return { pkg, lock, files };
}

function selfTest() {
  const good = readRepo();
  const cases = {
    "next 15 in package.json": { ...good, pkg: { ...good.pkg, dependencies: { ...good.pkg.dependencies, next: "15.5.18" } } },
    "next 15 in the lockfile": { ...good, lock: { packages: { "node_modules/next": { version: "15.5.18" } } } },
    "the override flag back in a build script": { ...good, files: [...good.files, { file: "package.json#cf:build", text: `opennextjs-cloudflare build --${FLAG}` }] },
    "nothing scanned": { ...good, files: [] },
  };
  let bad = 0;
  if (check(good).errors.length) { console.error("self-test: the real repo should pass first"); bad++; }
  for (const [name, input] of Object.entries(cases)) {
    const failed = check(input).errors.length > 0;
    console.log(`self-test: ${name} -> ${failed ? "FAILS (correct)" : "PASSES (wrong)"}`);
    if (!failed) bad++;
  }
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const { errors, declared, locked, scanned } = check(readRepo());
  console.log(`next-version-floor: next ${declared} (lock ${locked}), ${scanned} build/deploy file(s) scanned for the override`);
  if (errors.length) {
    console.error("validate:next-version-floor FAILED");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("validate:next-version-floor PASS");
}
