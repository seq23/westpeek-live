#!/usr/bin/env node
/**
 * D1 schema parity (replaced the hosted-Postgres schema parity, migration-map-coverage and
 * migration-mirror-parity validators on 6 Oct 2026 — docs/SUPABASE_TO_CLOUDFLARE.md).
 *
 * migrations-d1/*.sql is the one definition of the database. This proves, from the files:
 *   1. lib/d1/schema.generated.ts is generated from exactly that SQL (the query layer's JSON/boolean
 *      handling and the health probe's table+column map both read it) — never stale;
 *   2. the SQL is SQLite, not Postgres: no jsonb, timestamptz, uuid, text[], gen_random_uuid, now(),
 *      ::casts, `do $$` blocks, schema-qualified names, RLS or policies;
 *   3. every table the code names (`.from("t")`, insertRecord/selectAll/selectByUserId, raw SQL
 *      FROM/INTO/UPDATE/JOIN) exists in migrations-d1;
 *   4. every column the code names against a table on the same chain (`.eq/.neq/.is/.order/.select`,
 *      `onConflict`) and every snake_case key in an `.insert({…})`/`.upsert({…})`/`.update({…})`
 *      payload exists in that table;
 *   5. the deploy workflow applies `wrangler d1 migrations apply west-peek-live --remote` BEFORE it
 *      deploys the Worker, and wrangler.jsonc binds DB to migrations-d1.
 *
 * Hard-fails on zero migration files, zero tables, zero code tables or zero code columns, so it can
 * never pass on an empty loop.
 *
 *   node scripts/validate_d1_schema_parity.js              validate the repo
 *   node scripts/validate_d1_schema_parity.js --self-test  break a copy four ways and prove each fails
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIRS = ["app", "components", "lib", "services"];
const FORBIDDEN = [
  [/\bjsonb\b/i, "jsonb"],
  [/\btimestamptz\b/i, "timestamptz"],
  [/\bgen_random_uuid\s*\(/i, "gen_random_uuid()"],
  [/\bnow\s*\(\s*\)/i, "now()"],
  [/::[a-z]/i, "a ::cast"],
  [/\bdo\s+\$\$/i, "a do $$ block"],
  [/\bpublic\./i, "a public. schema-qualified name"],
  [/\b(uuid|text\[\]|timestamp)\b(?![a-z_])/i, "a Postgres-only type"],
  [/row\s+level\s+security/i, "row level security"],
  [/\bcreate\s+policy\b/i, "a policy"],
];

function parseMigrations(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort() : [];
  const tables = new Map();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const re = /CREATE TABLE IF NOT EXISTS (\w+) \(\n([\s\S]*?)\n\);/g;
    let m;
    while ((m = re.exec(sql))) {
      const columns = new Set();
      for (const raw of m[2].split("\n")) {
        const col = /^\s+([a-z_][a-z0-9_]*) (TEXT|INTEGER|REAL)\b/.exec(raw);
        if (col) columns.add(col[1]);
      }
      tables.set(m[1], { file, columns });
    }
  }
  return { files, tables };
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".generated.ts")) out.push(full);
  }
  return out;
}

/** The text of the object literal opened at `index` (the `{`), braces balanced. */
function objectLiteralAt(text, index) {
  let depth = 0;
  for (let i = index; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(index, i + 1);
    }
  }
  return "";
}

function codeReferences(root) {
  const tables = new Map(); // table -> Set(files)
  const columns = []; // { table, column, file }
  const note = (table, file) => {
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table).add(path.relative(root, file));
  };
  for (const file of SOURCE_DIRS.flatMap((dir) => walk(path.join(root, dir)))) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:insertRecord|selectAll(?:<[^>]*>)?)\(this\.client, "([a-z0-9_]+)"/g)) note(m[1], file);
    for (const m of text.matchAll(/selectByUserId<[^>]*>\("([a-z0-9_]+)"/g)) note(m[1], file);
    for (const m of text.matchAll(/(?:FROM|INTO|UPDATE|JOIN) "([a-z0-9_]+)"/g)) note(m[1], file);
    // Chains: `.from("t")` up to the end of the statement.
    for (const m of text.matchAll(/\.from\("([a-z0-9_]+)"\)/g)) {
      const table = m[1];
      note(table, file);
      const rest = text.slice(m.index);
      const end = rest.search(/;\s*\n/);
      const chain = end < 0 ? rest : rest.slice(0, end);
      for (const c of chain.matchAll(/\.(?:eq|neq|is|order|gt|gte|lt|lte|ilike|in)\("([a-z0-9_]+)"/g)) columns.push({ table, column: c[1], file });
      for (const c of chain.matchAll(/\.select\("([a-z0-9_, ]+)"/g)) for (const name of c[1].split(",").map((s) => s.trim()).filter((s) => s && s !== "*")) columns.push({ table, column: name, file });
      for (const c of chain.matchAll(/onConflict: "([a-z0-9_,]+)"/g)) for (const name of c[1].split(",")) columns.push({ table, column: name, file });
      for (const c of chain.matchAll(/\.or\(`([^`]*)`\)/g)) for (const clause of c[1].split(",")) { const col = /^([a-z_][a-z0-9_]*)\./.exec(clause); if (col) columns.push({ table, column: col[1], file }); }
      for (const w of chain.matchAll(/\.(?:insert|upsert|update)\(\{/g)) {
        const literal = objectLiteralAt(chain, w.index + w[0].length - 1);
        // Top-level keys only: nested objects (a jsonb value) are data, not columns.
        let depth = 0;
        let flat = "";
        for (const ch of literal.slice(1, -1)) {
          if (ch === "{" || ch === "[" || ch === "(") depth += 1;
          else if (ch === "}" || ch === "]" || ch === ")") depth -= 1;
          else if (depth === 0) flat += ch;
        }
        for (const k of flat.matchAll(/(?:^|,)\s*([a-z][a-z0-9]*_[a-z0-9_]+|[a-z]+)\s*:/g)) {
          if (/^[a-z]+$/.test(k[1]) && !["id", "key", "email", "name", "state", "status", "kind", "role", "title", "slug", "format", "sessions", "branding", "members", "capability", "note", "notes", "phone", "company", "message", "subject", "audience", "provider", "visibility", "scope", "code", "field", "reason", "signal", "action", "description", "industry", "intro", "body", "granted", "locked", "timezone", "details", "severity", "metadata"].includes(k[1])) continue;
          columns.push({ table, column: k[1], file });
        }
      }
    }
  }
  return { tables, columns };
}

function validate(root) {
  const failures = [];
  const migrationsDir = path.join(root, "migrations-d1");
  const { files, tables } = parseMigrations(migrationsDir);
  if (!files.length) failures.push("migrations-d1 has zero migration files; there is no schema to prove");
  if (!tables.size) failures.push("migrations-d1 declares zero tables");

  // 1. manifest current
  const generator = path.join(root, "scripts/generate_d1_schema_manifest.mjs");
  try {
    execFileSync(process.execPath, [generator, "--check"], { cwd: root, stdio: "pipe" });
  } catch (error) {
    failures.push(`lib/d1/schema.generated.ts is stale or unreadable: ${String((error.stderr || error.message || "")).trim().split("\n")[0]}`);
  }

  // 2. SQLite only
  let forbiddenChecks = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8").replace(/--.*$/gm, "");
    for (const [pattern, label] of FORBIDDEN) {
      forbiddenChecks += 1;
      if (pattern.test(sql)) failures.push(`migrations-d1/${file} contains ${label}; D1 is SQLite`);
    }
  }

  // 3 + 4. code references
  const refs = codeReferences(root);
  if (!refs.tables.size) failures.push("found zero tables named in app/components/lib/services; the scan is broken");
  if (!refs.columns.length) failures.push("found zero columns named in query chains; the scan is broken");
  for (const [table, where] of refs.tables) {
    if (!tables.has(table)) failures.push(`code names table ${table} (${Array.from(where).slice(0, 2).join(", ")}) but migrations-d1 does not create it`);
  }
  for (const { table, column, file } of refs.columns) {
    const t = tables.get(table);
    if (t && !t.columns.has(column)) failures.push(`${path.relative(root, file)} names ${table}.${column}, which migrations-d1/${t.file} does not declare`);
  }

  // 5. deploy order and binding
  const workflowPath = path.join(root, ".github/workflows/deploy-cloudflare-worker.yml");
  const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, "utf8") : "";
  const applyAt = workflow.indexOf("d1 migrations apply west-peek-live --remote");
  const deployAt = workflow.indexOf("npm run cf:deploy");
  if (applyAt < 0) failures.push("deploy-cloudflare-worker.yml never applies the D1 migrations");
  else if (deployAt < 0 || applyAt > deployAt) failures.push("deploy-cloudflare-worker.yml must apply the D1 migrations BEFORE npm run cf:deploy");
  const wrangler = fs.existsSync(path.join(root, "wrangler.jsonc")) ? fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8") : "";
  if (!/"binding":\s*"DB"[\s\S]*?"migrations_dir":\s*"migrations-d1"/.test(wrangler)) failures.push('wrangler.jsonc must bind D1 as "DB" with "migrations_dir": "migrations-d1"');

  const columnCount = Array.from(tables.values()).reduce((sum, t) => sum + t.columns.size, 0);
  const checked = files.length + tables.size + columnCount + forbiddenChecks + refs.tables.size + refs.columns.length + 2;
  return { failures, checked, files: files.length, tables: tables.size, columns: columnCount, codeTables: refs.tables.size, codeColumns: refs.columns.length };
}

function report(result) {
  if (result.failures.length) {
    console.error(`validate_d1_schema_parity: FAIL (${result.failures.length})`);
    for (const failure of result.failures.slice(0, 40)) console.error(`  - ${failure}`);
    return 1;
  }
  console.log(`validate_d1_schema_parity: PASS — ${result.checked} checks: ${result.files} migration files, ${result.tables} tables, ${result.columns} columns; code names ${result.codeTables} tables and ${result.codeColumns} column references, all present.`);
  return 0;
}

function copyRepoSubset(dest) {
  for (const rel of ["migrations-d1", "scripts/generate_d1_schema_manifest.mjs", "lib/d1/schema.generated.ts", ".github/workflows/deploy-cloudflare-worker.yml", "wrangler.jsonc", ...SOURCE_DIRS]) {
    const from = path.join(ROOT, rel);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, rel), { recursive: true });
  }
}

function selfTest() {
  const cases = [
    ["a Postgres type in a migration", (dir) => fs.appendFileSync(path.join(dir, "migrations-d1/0001_core.sql"), "\nCREATE TABLE IF NOT EXISTS broken (\n  id TEXT NOT NULL,\n  data jsonb\n);\n"), /contains jsonb/],
    ["a column the code reads is dropped", (dir) => { const f = path.join(dir, "migrations-d1/0003_runtime.sql"); fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("  confirm_token TEXT,\n", "")); }, /request_event_intake\.confirm_token/],
    ["zero migration files", (dir) => fs.rmSync(path.join(dir, "migrations-d1"), { recursive: true, force: true }), /zero migration files/],
    ["deploy before migrate", (dir) => { const f = path.join(dir, ".github/workflows/deploy-cloudflare-worker.yml"); fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/d1 migrations apply west-peek-live --remote/g, "d1 migrations list west-peek-live --remote")); }, /never applies the D1 migrations/],
  ];
  let failed = 0;
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), "d1-parity-clean-"));
  copyRepoSubset(clean);
  const baseline = validate(clean);
  if (baseline.failures.length) { console.error(`self-test: the unbroken copy failed: ${baseline.failures[0]}`); failed += 1; }
  for (const [name, breakIt, expected] of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d1-parity-"));
    copyRepoSubset(dir);
    breakIt(dir);
    const result = validate(dir);
    const hit = result.failures.some((f) => expected.test(f));
    console.log(`self-test ${hit ? "PASS" : "FAIL"}: ${name} ${hit ? "is caught" : "was NOT caught"}`);
    if (!hit) failed += 1;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.rmSync(clean, { recursive: true, force: true });
  if (failed) { console.error(`validate_d1_schema_parity --self-test: FAIL (${failed})`); return 1; }
  console.log(`validate_d1_schema_parity --self-test: PASS — ${cases.length} breakages caught, clean copy passes`);
  return 0;
}

if (require.main === module) {
  process.exit(process.argv.includes("--self-test") ? selfTest() : report(validate(ROOT)));
}

module.exports = { validate, parseMigrations };
