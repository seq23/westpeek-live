/**
 * Read-only helpers over migrations-d1/*.sql for the contract validators. Since 6 Oct 2026 the D1
 * migrations are the only schema (they replaced db/migrations and its mirror directory), so
 * a validator that used to read "the 0031 migration" reads the table's CREATE block here instead.
 */
const fs = require("fs");
const path = require("path");

const DIR = "migrations-d1";

function d1Files(root = process.cwd()) {
  const dir = path.join(root, DIR);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort() : [];
}

function d1Sql(root = process.cwd()) {
  return d1Files(root).map((f) => fs.readFileSync(path.join(root, DIR, f), "utf8")).join("\n");
}

/** The table's CREATE TABLE block plus every CREATE INDEX on it, or "" when no migration creates it. */
function d1Table(name, root = process.cwd()) {
  for (const file of d1Files(root)) {
    const sql = fs.readFileSync(path.join(root, DIR, file), "utf8");
    const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${name} (\n`);
    if (start < 0) continue;
    const end = sql.indexOf("\n);", start) + 3;
    const indexes = sql.split("\n").filter((line) => new RegExp(`^CREATE (UNIQUE )?INDEX IF NOT EXISTS \\w+ ON ${name} \\(`).test(line));
    return { file: `${DIR}/${file}`, sql: [sql.slice(start, end), ...indexes].join("\n") };
  }
  return { file: "", sql: "" };
}

/** Failures for each token missing from the table's D1 definition. */
function requireD1(name, tokens, root = process.cwd()) {
  const { file, sql } = d1Table(name, root);
  if (!sql) return [`migrations-d1 does not create table ${name}`];
  return tokens.filter((token) => !sql.includes(token)).map((token) => `${file} (${name}) missing: ${token}`);
}

module.exports = { d1Files, d1Sql, d1Table, requireD1, D1_DIR: DIR };
