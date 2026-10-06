import fs from "node:fs";
import path from "node:path";
import { Miniflare } from "miniflare";
import type { D1DatabaseLike } from "@/lib/d1/query";

/**
 * A real D1 (workerd's SQLite, through Miniflare) with every migrations-d1 file applied in order —
 * the same files `wrangler d1 migrations apply` runs against production. Each call is a fresh,
 * empty, in-memory database.
 */
export function migrationStatements(dir = path.resolve(__dirname, "../../../migrations-d1")) {
  return fs
    .readdirSync(dir)
    .filter((file) => /^\d{4}_.*\.sql$/.test(file))
    .sort()
    .flatMap((file) =>
      fs
        .readFileSync(path.join(dir, file), "utf8")
        .split(/;\s*\n/)
        .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
        .filter(Boolean),
    );
}

export async function createTestD1(options: { migrate?: boolean } = {}) {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", d1Databases: ["DB"] });
  const db = (await mf.getD1Database("DB")) as unknown as D1DatabaseLike & { exec(sql: string): Promise<unknown> };
  if (options.migrate !== false) {
    const statements = migrationStatements();
    await db.batch(statements.map((sql) => db.prepare(sql)));
  }
  return { db, dispose: () => mf.dispose() };
}
