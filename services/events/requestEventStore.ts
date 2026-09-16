import { isSupabaseAdminConfigured } from "@/lib/env";

/**
 * Public event-request intake.
 *
 * This used to write a JSON file under `.runtime-data/` via `require("fs")`,
 * which cannot work on the Worker this site is deployed to, and — worse — could
 * not report that it had not worked. `appendRequestEventRecord` returned the
 * record it was handed on both the success and the failure path, so the caller
 * had no way to tell a stored request from a discarded one, and the visitor was
 * shown "Request received" either way.
 *
 * On Cloudflare the filesystem branch was not even a silent no-op. With this
 * project's `compatibility_date` (2024-12-30, i.e. before the 2025-09-15 cutoff
 * that enables native `node:fs`) and no `enable_nodejs_fs_module` flag, wrangler
 * resolves `fs` to unenv's polyfill. That polyfill's `existsSync` returns false
 * and its `mkdirSync`/`writeFileSync`/`renameSync` throw
 * "[unenv] fs.mkdirSync is not implemented yet!". The object is truthy, so the
 * `if (!fs) return` guard did not fire and the write threw instead — taking the
 * notification email down with it, since the throw happened before `sendEmail`.
 *
 * Bumping the compatibility date would only convert that crash into a genuine
 * silent drop: workerd's filesystem is per-isolate and ephemeral, so a request
 * written to it is gone as soon as the isolate is recycled. Intake has to go
 * somewhere durable, so it goes to Supabase, which every other persisted
 * surface in this app already uses.
 *
 * The contract this file now keeps: a caller can always tell whether the
 * request was stored. Nothing here reports success it did not observe.
 *
 * Since 16 Sep 2026 the row it writes is the FIRST state of a request that runs
 * all the way to paid (migration 0034), so the write itself goes through the
 * runtime store like every other runtime row. This file stays the public front
 * door's own adapter: it keeps the never-throw contract, the machine-readable
 * reason, and the "is there anywhere durable to put this" guard, all of which
 * the intake action's receipt decision depends on.
 */

import { submitEventRequest, listEventRequests } from "@/services/event-intake/eventRequestPipeline";
import type { EventRequestRecord } from "@/types/eventRequest";

/** The public form's shape. The stored row carries more (state, price, tokens); this is what arrives. */
export interface RequestEventRecord {
  id: string;
  name: string;
  email: string;
  company?: string;
  eventType?: string;
  eventDate?: string;
  audienceSize?: string;
  livestreamNeeds?: string;
  networkingNeeds?: string;
  sponsorExpoNeeds?: string;
  speakerCount?: string;
  supportLevel?: string;
  notes?: string;
  /** The band the visitor picked. Required on the form; a request without one is not scopable. */
  budgetRange?: string;
  createdAt: string;
}

/**
 * The outcome of an intake write. `ok: false` always carries a machine-readable
 * reason so the caller can log precisely why a request was not stored rather
 * than guessing.
 */
export type RequestEventPersistResult =
  | { ok: true; record: RequestEventRecord }
  | { ok: false; record: RequestEventRecord; reason: string };

/**
 * Read intake records back. Previously this always returned `[]` on the Worker,
 * because unenv's `existsSync` is hardcoded to false — and it was called from
 * inside the append path, so a working filesystem would have caused an append to
 * truncate every earlier record. Both problems disappear with a real insert.
 */
export async function readRequestEventRecords(): Promise<EventRequestRecord[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return listEventRequests();
}

/**
 * Store one event request. Never throws: the caller needs a decision about what
 * to show the visitor, not an exception, and an intake path that can 500 is an
 * intake path that loses requests. Every failure comes back as `ok: false` with
 * a reason.
 */
export async function appendRequestEventRecord(
  record: RequestEventRecord,
): Promise<RequestEventPersistResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, record, reason: "supabase_not_configured" };
  }

  const result = await submitEventRequest(record);
  return result.ok ? { ok: true, record } : { ok: false, record, reason: result.reason };
}
