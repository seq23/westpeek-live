import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDbClient, type D1DatabaseLike, type DbClient } from "./query";

/**
 * The Worker's D1 binding (`DB` in wrangler.jsonc) and the R2 bucket (`ASSETS_BUCKET`).
 *
 * Inside the deployed Worker they come from the OpenNext Cloudflare context. Outside it (`next dev`
 * without bindings, unit tests, the build) there is no binding: getD1() returns undefined and the
 * caller decides — the runtime store falls back to the file store locally and refuses in production.
 * Tests inject an in-memory D1 through setD1ForTests().
 */
let testDb: D1DatabaseLike | undefined;
let testBucket: R2BucketLike | undefined;

export interface R2ObjectBodyLike {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | ReadableStream | Uint8Array | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  head(key: string): Promise<unknown | null>;
  delete(key: string): Promise<void>;
}

function cloudflareEnv(): Record<string, unknown> | undefined {
  try {
    return getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function getD1(): D1DatabaseLike | undefined {
  if (testDb) return testDb;
  const db = cloudflareEnv()?.DB as D1DatabaseLike | undefined;
  return db && typeof db.prepare === "function" ? db : undefined;
}

export function getDbClient(): DbClient {
  const db = getD1();
  if (!db) throw new Error("D1 is not bound on this deployment (binding DB in wrangler.jsonc).");
  return createDbClient(db);
}

export function getAssetsBucket(): R2BucketLike | undefined {
  if (testBucket) return testBucket;
  const bucket = cloudflareEnv()?.ASSETS_BUCKET as R2BucketLike | undefined;
  return bucket && typeof bucket.put === "function" ? bucket : undefined;
}

export function setD1ForTests(db: D1DatabaseLike | undefined) {
  testDb = db;
}

export function setAssetsBucketForTests(bucket: R2BucketLike | undefined) {
  testBucket = bucket;
}
