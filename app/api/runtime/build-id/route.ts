import { NextResponse } from "next/server";
import { CURRENT_BUILD_ID } from "@/lib/runtime/buildVersion";

export const dynamic = "force-dynamic";

/**
 * The cheapest possible answer to "which build is live?" — no store read, no secrets. The workspace
 * and crew pages poll it so a deploy that swaps the client chunks under an open page reloads it
 * instead of throwing "Application error: a client-side exception has occurred" (seen on
 * /app/owner, 16 Sep 2026).
 */
export async function GET() {
  return NextResponse.json({ ok: true, buildId: CURRENT_BUILD_ID }, { headers: { "cache-control": "no-store" } });
}
