// RUNBOOK.md is read by AI employees (Porter in West Peek OS, Danielle in Boss OS) at plan time,
// and the West Peek OS web-property lane refuses to plan a change for a repo without one. A runbook
// naming a path or script that no longer exists sends the reader to the wrong place, so this fails
// the build the moment they drift. Hard-fails on a missing runbook and on one that names nothing.
import fs from "node:fs";

const errors = [];
if (!fs.existsSync("RUNBOOK.md")) {
  console.error("validate:runbook FAILED\n  - RUNBOOK.md is missing at the repo root");
  process.exit(1);
}
const md = fs.readFileSync("RUNBOOK.md", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

// Backticked repo paths under this repo's top-level source dirs, plus backticked root files.
// Anything with a <placeholder> is a template, not a path.
const DIRS = "app|components|lib|services|types|scripts|migrations-d1|db|docs|tests|config|deployment|data|public|\\.github";
const dirPaths = [...md.matchAll(new RegExp("`((?:" + DIRS + ")/[^`#\\s]*?)`", "g"))].map((m) => m[1]);
const rootFiles = [...md.matchAll(/`([A-Za-z0-9_.-]+\.(?:md|json|jsonc|ts|js|mjs|toml)|\.nvmrc)`/g)].map((m) => m[1]);
const paths = [...new Set([...dirPaths, ...rootFiles])].filter((p) => !p.includes("<"));
const scripts = [...new Set([...md.matchAll(/npm run ([a-z0-9:-]+)/g)].map((m) => m[1]))];

if (!dirPaths.length || !scripts.length) errors.push("RUNBOOK.md names no repo paths or no npm scripts");
for (const p of paths) if (!fs.existsSync(p)) errors.push(`RUNBOOK.md names ${p}, which does not exist`);
for (const s of scripts) if (!pkg.scripts?.[s]) errors.push(`RUNBOOK.md names npm run ${s}, which package.json does not define`);

console.log(`runbook: ${paths.length} path(s) and ${scripts.length} script(s) verified`);
if (errors.length) {
  console.error("validate:runbook FAILED");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("validate:runbook PASS");
