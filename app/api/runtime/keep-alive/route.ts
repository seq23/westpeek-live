import { NextResponse } from "next/server";
import { pingRuntimeStore } from "@/services/runtime/supabaseKeepAlive";

export const dynamic = "force-dynamic";

/**
 * The scheduled keep-alive Supabase Free needs. `.github/workflows/supabase-keep-alive.yml` calls
 * this once a day; the seven-day idle clock never gets past one.
 *
 * One indexed single-row read, nothing written, nothing logged — call it once or a hundred times
 * and the database is in the same state. `store` is in the answer on purpose: a "file" store means
 * the ping did nothing for Supabase, and the workflow fails on that rather than reporting a green
 * run that kept nothing awake.
 */
export async function GET() {
  const ping = await pingRuntimeStore();
  return NextResponse.json(
    { ok: ping.ok, store: ping.store, pingedAt: ping.pingedAt, detail: ping.detail || undefined },
    { status: ping.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
