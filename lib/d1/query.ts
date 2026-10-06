import { D1_SCHEMA, type D1ColumnKind } from "./schema.generated";

/**
 * The query layer every store and service uses against Cloudflare D1.
 *
 * It keeps the chained shape the code was written against (`from(table).select().eq().order()`,
 * `{ data, error }` back, never a throw for a database error) so the call sites read the same, and
 * it compiles each chain to ONE parameterised SQL statement. Identifiers are checked against a
 * strict pattern and quoted; every value is a bound parameter.
 *
 * Column kinds come from lib/d1/schema.generated.ts (itself generated from migrations-d1/*.sql):
 * JSON columns are stringified on write and parsed on read, boolean columns are 0/1 in the table and
 * true/false in the row the caller sees.
 */

/** The subset of the D1 binding this layer uses (the real `D1Database` satisfies it). */
export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta?: { changes?: number } }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}
export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedLike;
  batch(statements: D1PreparedLike[]): Promise<Array<{ results?: unknown[]; meta?: { changes?: number } }>>;
}

export interface DbError {
  message: string;
  code?: string;
}
export type DbResult<T> = { data: T; error: null; count?: number } | { data: null; error: DbError; count?: number };

type Row = Record<string, unknown>;
type Filter = { sql: string; params: unknown[] };
type Mode = "select" | "insert" | "upsert" | "update" | "delete";

const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(name: string) {
  const trimmed = name.trim();
  if (!IDENT.test(trimmed)) throw new Error(`d1: refused identifier "${name}"`);
  return `"${trimmed}"`;
}

function kindOf(table: string, column: string): D1ColumnKind | undefined {
  return D1_SCHEMA[table]?.columns[column];
}

/** One value on its way into a bound parameter. */
export function encodeValue(table: string, column: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const kind = kindOf(table, column);
  if (kind === "json") return JSON.stringify(value);
  if (kind === "bool") return value ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

/** One row on its way back to the caller: JSON parsed, 0/1 booleans as true/false. */
export function decodeRow(table: string, row: Row): Row {
  const schema = D1_SCHEMA[table];
  if (!schema) return row;
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const kind = schema.columns[key];
    if (value === null || value === undefined) out[key] = null;
    else if (kind === "json") {
      try {
        out[key] = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        out[key] = null;
      }
    } else if (kind === "bool") out[key] = value === 1 || value === true || value === "1";
    else out[key] = value;
  }
  return out;
}

function errorFrom(error: unknown): DbError {
  const message = error instanceof Error ? error.message : String(error);
  return { message, code: /no such table/i.test(message) ? "D1_NO_TABLE" : /no such column|has no column named/i.test(message) ? "D1_NO_COLUMN" : undefined };
}

/** PostgREST-style `a.eq.x,b.gt.y` → SQL. Only the operators the code uses are accepted. */
function parseOr(table: string, expression: string): Filter {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const clause of expression.split(",")) {
    const match = /^([a-z_][a-z0-9_]*)\.(eq|neq|gt|gte|lt|lte|is|ilike|like)\.(.*)$/.exec(clause.trim());
    if (!match) throw new Error(`d1: unsupported or() clause "${clause}"`);
    const [, column, op, raw] = match;
    if (op === "is") {
      if (raw !== "null") throw new Error(`d1: or() supports "is.null" only, got "${clause}"`);
      parts.push(`${ident(column)} IS NULL`);
      continue;
    }
    const sqlOp = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", ilike: "LIKE", like: "LIKE" }[op as "eq"];
    parts.push(`${ident(column)} ${sqlOp} ?`);
    params.push(encodeValue(table, column, raw));
  }
  return { sql: `(${parts.join(" OR ")})`, params };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are untyped until the caller maps them, as before
export class D1Query<T = any> implements PromiseLike<DbResult<T>> {
  private mode: Mode = "select";
  private columns = "*";
  private returning = false;
  private head = false;
  private countExact = false;
  private payload: Row[] = [];
  private onConflict?: string[];
  private ignoreDuplicates = false;
  private filters: Filter[] = [];
  private orders: string[] = [];
  private limitCount?: number;
  private singleMode: "many" | "single" | "maybe" = "many";

  constructor(private readonly db: D1DatabaseLike, private readonly table: string) {
    ident(table);
  }

  select(columns = "*", options?: { head?: boolean; count?: "exact" }) {
    if (this.mode === "select") {
      this.columns = columns;
      this.head = Boolean(options?.head);
      this.countExact = options?.count === "exact";
    } else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = options?.onConflict?.split(",").map((s) => s.trim());
    this.ignoreDuplicates = Boolean(options?.ignoreDuplicates);
    return this;
  }

  update(values: Row) {
    this.mode = "update";
    this.payload = [values];
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  private compare(column: string, op: string, value: unknown) {
    this.filters.push({ sql: `${ident(column)} ${op} ?`, params: [encodeValue(this.table, column, value)] });
    return this;
  }

  eq(column: string, value: unknown) { return this.compare(column, "=", value); }
  neq(column: string, value: unknown) {
    // PostgREST neq never matches NULL either (SQL three-valued logic) — same here.
    return this.compare(column, "<>", value);
  }
  gt(column: string, value: unknown) { return this.compare(column, ">", value); }
  gte(column: string, value: unknown) { return this.compare(column, ">=", value); }
  lt(column: string, value: unknown) { return this.compare(column, "<", value); }
  lte(column: string, value: unknown) { return this.compare(column, "<=", value); }
  /** SQLite LIKE is case-insensitive for ASCII, which is what ilike meant here. */
  ilike(column: string, pattern: string) { return this.compare(column, "LIKE", pattern); }

  is(column: string, value: null | boolean) {
    if (value === null) this.filters.push({ sql: `${ident(column)} IS NULL`, params: [] });
    else this.filters.push({ sql: `${ident(column)} = ?`, params: [value ? 1 : 0] });
    return this;
  }

  in(column: string, values: unknown[]) {
    if (!values.length) {
      this.filters.push({ sql: "0", params: [] });
      return this;
    }
    this.filters.push({ sql: `${ident(column)} IN (${values.map(() => "?").join(", ")})`, params: values.map((v) => encodeValue(this.table, column, v)) });
    return this;
  }

  or(expression: string) {
    this.filters.push(parseOr(this.table, expression));
    return this;
  }

  match(query: Row) {
    for (const [column, value] of Object.entries(query)) this.eq(column, value);
    return this;
  }

  /** Postgres ordering: ascending puts NULLs last, descending puts them first, unless told otherwise. */
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    const ascending = options?.ascending !== false;
    const nullsFirst = options?.nullsFirst ?? !ascending;
    this.orders.push(`${ident(column)} ${ascending ? "ASC" : "DESC"} NULLS ${nullsFirst ? "FIRST" : "LAST"}`);
    return this;
  }

  limit(count: number) {
    this.limitCount = Math.max(0, Math.floor(count));
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  private selectList() {
    if (this.columns.trim() === "*") return "*";
    return this.columns.split(",").map((c) => ident(c)).join(", ");
  }

  private where(): Filter {
    if (!this.filters.length) return { sql: "", params: [] };
    return { sql: ` WHERE ${this.filters.map((f) => f.sql).join(" AND ")}`, params: this.filters.flatMap((f) => f.params) };
  }

  /** A row without its generated id gets one minted here, as `gen_random_uuid()` used to. */
  private withId(row: Row): Row {
    const pk = D1_SCHEMA[this.table]?.primaryKey;
    if (pk && pk.length === 1 && pk[0] === "id" && (row.id === undefined || row.id === null)) return { id: crypto.randomUUID(), ...row };
    return row;
  }

  private writeStatement(row: Row): { sql: string; params: unknown[] } {
    const entries = Object.entries(this.withId(row)).filter(([, v]) => v !== undefined);
    if (!entries.length) throw new Error(`d1: empty ${this.mode} into ${this.table}`);
    const cols = entries.map(([k]) => ident(k));
    const params = entries.map(([k, v]) => encodeValue(this.table, k, v));
    let sql = `INSERT INTO ${ident(this.table)} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
    if (this.mode === "upsert") {
      const target = this.onConflict?.length ? this.onConflict : D1_SCHEMA[this.table]?.primaryKey;
      if (!target?.length) throw new Error(`d1: upsert into ${this.table} has no conflict target`);
      const updates = entries.map(([k]) => k).filter((k) => !target.includes(k));
      sql += ` ON CONFLICT (${target.map(ident).join(", ")}) `;
      sql += this.ignoreDuplicates || !updates.length ? "DO NOTHING" : `DO UPDATE SET ${updates.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ")}`;
    }
    if (this.returning) sql += ` RETURNING ${this.selectList()}`;
    return { sql, params };
  }

  private shape(rows: Row[], count?: number): DbResult<T> {
    const decoded = rows.map((r) => decodeRow(this.table, r));
    if (this.singleMode === "maybe") {
      if (decoded.length > 1) return { data: null, error: { message: `${this.table}: expected at most one row, got ${decoded.length}`, code: "PGRST116" } };
      return { data: (decoded[0] ?? null) as T, error: null };
    }
    if (this.singleMode === "single") {
      if (decoded.length !== 1) return { data: null, error: { message: `${this.table}: expected exactly one row, got ${decoded.length}`, code: "PGRST116" } };
      return { data: decoded[0] as T, error: null };
    }
    return { data: decoded as T, error: null, count };
  }

  async execute(): Promise<DbResult<T>> {
    try {
      const table = ident(this.table);
      if (this.mode === "select") {
        const where = this.where();
        if (this.head) {
          // Names the columns without fetching a row, so a missing column fails by name; then counts.
          await this.db.prepare(`SELECT ${this.selectList()} FROM ${table}${where.sql} LIMIT 0`).bind(...where.params).all<Row>();
          const counted = await this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}${where.sql}`).bind(...where.params).all<Row>();
          return { data: [] as T, error: null, count: Number(counted.results[0]?.n ?? 0) };
        }
        let sql = `SELECT ${this.selectList()} FROM ${table}${where.sql}`;
        if (this.orders.length) sql += ` ORDER BY ${this.orders.join(", ")}`;
        const limit = this.limitCount ?? (this.singleMode === "many" ? undefined : 2);
        if (limit !== undefined) sql += ` LIMIT ${limit}`;
        const { results } = await this.db.prepare(sql).bind(...where.params).all<Row>();
        let count: number | undefined;
        if (this.countExact) {
          const counted = await this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}${where.sql}`).bind(...where.params).all<Row>();
          count = Number(counted.results[0]?.n ?? 0);
        }
        return this.shape(results, count);
      }
      if (this.mode === "insert" || this.mode === "upsert") {
        const statements = this.payload.map((row) => this.writeStatement(row));
        if (statements.length === 1) {
          const { sql, params } = statements[0];
          if (this.returning) return this.shape((await this.db.prepare(sql).bind(...params).all<Row>()).results);
          await this.db.prepare(sql).bind(...params).run();
          return { data: null as T, error: null } as DbResult<T>;
        }
        const results = await this.db.batch(statements.map(({ sql, params }) => this.db.prepare(sql).bind(...params)));
        return this.returning ? this.shape(results.flatMap((r) => (r.results || []) as Row[])) : ({ data: null as T, error: null } as DbResult<T>);
      }
      if (this.mode === "update") {
        const entries = Object.entries(this.payload[0]).filter(([, v]) => v !== undefined);
        if (!entries.length) throw new Error(`d1: empty update of ${this.table}`);
        const where = this.where();
        if (!where.sql) throw new Error(`d1: refused an update of ${this.table} with no filter`);
        let sql = `UPDATE ${table} SET ${entries.map(([k]) => `${ident(k)} = ?`).join(", ")}${where.sql}`;
        const params = [...entries.map(([k, v]) => encodeValue(this.table, k, v)), ...where.params];
        if (this.returning) {
          sql += ` RETURNING ${this.selectList()}`;
          return this.shape((await this.db.prepare(sql).bind(...params).all<Row>()).results);
        }
        const run = await this.db.prepare(sql).bind(...params).run();
        return { data: null as T, error: null, count: run.meta?.changes } as DbResult<T>;
      }
      const where = this.where();
      if (!where.sql) throw new Error(`d1: refused a delete from ${this.table} with no filter`);
      let sql = `DELETE FROM ${table}${where.sql}`;
      if (this.returning) {
        sql += ` RETURNING ${this.selectList()}`;
        return this.shape((await this.db.prepare(sql).bind(...where.params).all<Row>()).results);
      }
      const run = await this.db.prepare(sql).bind(...where.params).run();
      return { data: null as T, error: null, count: run.meta?.changes } as DbResult<T>;
    } catch (error) {
      return { data: null, error: errorFrom(error) };
    }
  }

  then<R1 = DbResult<T>, R2 = never>(onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null, onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export interface DbClient {
  from(table: string): D1Query;
  /** The raw binding, for the few reads that are not a single-table chain (schema probe, joins). */
  readonly db: D1DatabaseLike;
}

export function createDbClient(db: D1DatabaseLike): DbClient {
  return { db, from: (table: string) => new D1Query(db, table) };
}
