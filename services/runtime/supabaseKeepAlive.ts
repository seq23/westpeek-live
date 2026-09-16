import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { getEnv, isSupabaseAdminConfigured } from "@/lib/env";

/**
 * KEEP THE FREE SUPABASE PROJECT AWAKE.
 *
 * Supabase Free pauses a project after seven idle days, and a paused project takes the runtime
 * store — every event, every attendee, every access code — offline until somebody notices and
 * clicks Restore. Between shows this repo can easily go a fortnight without a real query.
 *
 * So: one trivial read, on a schedule. `getContact` by a primary key that does not exist is a
 * single-row indexed SELECT that returns null — the smallest query that still counts as activity.
 * It writes nothing, so it is idempotent by construction: call it once or a hundred times and the
 * database is in exactly the state it was. It logs nothing either; a keep-alive that prints on every
 * run is noise in the tail that hides a real show-day error.
 */
export const KEEP_ALIVE_PROBE_KEY = "__keep_alive_probe__";

export interface KeepAlivePingResult {
  ok: boolean;
  /** "supabase" is the only store the pause applies to; "file" means the ping did nothing for Supabase. */
  store: "supabase" | "file";
  pingedAt: string;
  /** Empty when the read succeeded. Never swallowed: a silent failure is a paused project nobody sees. */
  detail: string;
}

function storeKind(): "supabase" | "file" {
  const strategy = process.env.AGENCY_EVENT_OS_RUNTIME_STORE;
  if (strategy === "supabase") return "supabase";
  if (strategy === "file") return "file";
  return isSupabaseAdminConfigured(getEnv()) ? "supabase" : "file";
}

export async function pingRuntimeStore(): Promise<KeepAlivePingResult> {
  const store = storeKind();
  const pingedAt = new Date().toISOString();
  try {
    await getRuntimeStore().getContact(KEEP_ALIVE_PROBE_KEY);
    return { ok: true, store, pingedAt, detail: "" };
  } catch (error) {
    return { ok: false, store, pingedAt, detail: error instanceof Error ? error.message : String(error) };
  }
}
