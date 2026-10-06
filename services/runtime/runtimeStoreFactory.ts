import { getD1 } from "@/lib/d1/binding";
import { createDbClient } from "@/lib/d1/query";
import { FileRuntimeStore } from "./fileRuntimeStore";
import { D1RuntimeStore } from "./d1RuntimeStore";
import type { RuntimeStore } from "./runtimeStore";

let runtimeStore: RuntimeStore | undefined;

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";

/**
 * D1 whenever the Worker has its `DB` binding (production, preview, `wrangler dev`); the file store
 * only where there is no binding at all (plain `next dev`, unit tests). AGENCY_EVENT_OS_RUNTIME_STORE
 * can force `file` locally; any other value is ignored, because a binding that exists is the truth.
 *
 * The D1 store is built per request around the binding of THAT request (a Worker binding is not a
 * global), and is never cached across requests; the file store is a process singleton.
 */
export function getRuntimeStore(): RuntimeStore {
  if (runtimeStore) return runtimeStore;
  const forced = process.env.AGENCY_EVENT_OS_RUNTIME_STORE;
  const db = forced === "file" ? undefined : getD1();
  if (db) return new D1RuntimeStore(createDbClient(db));
  if (process.env.NODE_ENV === "production" && !isProductionBuild && process.env.ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION !== "true") {
    throw new Error("Production runtime persistence requires the D1 binding DB (wrangler.jsonc) or ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION=true for an explicit file-store deployment.");
  }
  runtimeStore = new FileRuntimeStore();
  return runtimeStore;
}

export function setRuntimeStoreForTests(store: RuntimeStore | undefined) {
  runtimeStore = store;
}
