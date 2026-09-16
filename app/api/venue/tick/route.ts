import { NextResponse } from "next/server";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { commandBarVisibleTo } from "@/lib/navigation/eventCommandSurfaces";
import { getEventHealthReport } from "@/services/venue/eventHealthService";

export const dynamic = "force-dynamic";

/**
 * ONE combined poll for the Event Command Bar: every health signal and the per-show log in a single
 * request. Nine signals polled separately would be nine round trips from every open owner page
 * during a show, and the dot would flicker as they landed out of order.
 *
 * Owner and operator only — the bar itself is owner/operator only, and the signals name internal
 * failures (missing tables, LiveKit refusals) an attendee must never read. Never returns a stream
 * key: credentials live behind the go-live action, not behind a poll.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  const stageId = url.searchParams.get("stageId") || "main-stage";
  const clientBuildId = url.searchParams.get("buildId") || undefined;
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });

  const viewer = await getCrewViewer(eventId);
  if (!commandBarVisibleTo(viewer)) {
    return NextResponse.json({ ok: false, error: "The event health signal is for the owner and the operator." }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  try {
    const report = await getEventHealthReport({ eventId, stageId, clientBuildId });
    return NextResponse.json({ ok: true, ...report }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    // Fail soft: the bar keeps its last dot and says the tick failed, rather than blanking.
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "The health tick failed." }, { status: 200, headers: { "cache-control": "no-store" } });
  }
}
