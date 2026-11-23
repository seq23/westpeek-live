import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDbClient, type D1DatabaseLike, type DbClient } from "./query";

/**
 * The Worker's D1 binding (`DB` in wrangler.jsonc), the R2 bucket (`ASSETS_BUCKET`) and the gate
 * rate limiter (`GATE_LIMITER`).
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
  /** Resolves null, storing nothing, when an `onlyIf` precondition fails (etagDoesNotMatch "*" on an existing key). */
  put(key: string, value: ArrayBuffer | ReadableStream | Uint8Array | string, options?: { httpMetadata?: { contentType?: string }; onlyIf?: { etagDoesNotMatch?: string } }): Promise<unknown | null>;
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

/** The Cloudflare Rate Limiting binding's surface (`ratelimits` in wrangler.jsonc). */
export interface RateLimitBindingLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * The gate limiter (`GATE_LIMITER`). `inWorker` tells "not running in a Worker" (next dev/start,
 * tests: the caller uses its in-process stand-in) apart from "in a Worker without the binding",
 * which is an outage.
 */
export function getGateRateLimiter(): { inWorker: boolean; binding?: RateLimitBindingLike } {
  const env = cloudflareEnv();
  if (!env) return { inWorker: false };
  const binding = env.GATE_LIMITER as RateLimitBindingLike | undefined;
  return { inWorker: true, binding: binding && typeof binding.limit === "function" ? binding : undefined };
}

/** The wide count: one address across every event at a gate (services/access/gateAttemptLimiter.ts). */
export function getWideGateRateLimiter(): { inWorker: boolean; binding?: RateLimitBindingLike } {
  const env = cloudflareEnv();
  if (!env) return { inWorker: false };
  const binding = env.GATE_LIMITER_WIDE as RateLimitBindingLike | undefined;
  return { inWorker: true, binding: binding && typeof binding.limit === "function" ? binding : undefined };
}

export function setD1ForTests(db: D1DatabaseLike | undefined) {
  testDb = db;
}

export function setAssetsBucketForTests(bucket: R2BucketLike | undefined) {
  testBucket = bucket;
}

/** The Workers AI binding (`AI` in wrangler.jsonc), as far as this app uses it: one text model call. */
export interface WorkersAiLike {
  run(model: string, inputs: { messages: Array<{ role: "system" | "user"; content: string }>; max_tokens?: number; temperature?: number }): Promise<unknown>;
}

let testAi: { inWorker: boolean; binding?: WorkersAiLike } | undefined;

/** `inWorker` false: no Cloudflare context at all (next dev, unit tests), so there is no model to ask. */
export function getWorkersAi(): { inWorker: boolean; binding?: WorkersAiLike } {
  if (testAi) return testAi;
  const env = cloudflareEnv();
  if (!env) return { inWorker: false };
  const ai = env.AI as WorkersAiLike | undefined;
  return { inWorker: true, binding: ai && typeof ai.run === "function" ? ai : undefined };
}

/** Tests: a binding plays the Worker's `AI`; `undefined` is "in a Worker, not bound"; "unset" clears. */
export function setWorkersAiForTests(binding: WorkersAiLike | undefined | "unset") {
  testAi = binding === "unset" ? undefined : { inWorker: true, binding };
}
