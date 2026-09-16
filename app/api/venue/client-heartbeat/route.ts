import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ATTENDEE_SESSION_COOKIE } from "@/services/attendees/attendeeSessionService";
import { recordAttendeeClientHeartbeat } from "@/services/venue/attendeeClientHeartbeatService";
import { CURRENT_BUILD_ID } from "@/lib/runtime/buildVersion";

export const dynamic = "force-dynamic";

/**
 * The attendee's own browser reporting the half LiveKit cannot: its bundle, the connection quality
 * it is getting, and how many stage tracks it is actually subscribed to. It writes only to the
 * session the CALLER's own cookie names — nobody can report about anybody else — and it writes
 * nothing another attendee can see.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const eventId = String((body as { eventId?: string }).eventId || "");
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });
  const cookie = (await cookies()).get(ATTENDEE_SESSION_COOKIE)?.value || "";
  const firstDot = cookie.indexOf(".");
  // Unregistered viewers and crew have no attendee session; there is simply nothing to record.
  if (firstDot < 1 || cookie.slice(0, firstDot) !== eventId) return NextResponse.json({ ok: true, recorded: false, buildId: CURRENT_BUILD_ID }, { headers: { "cache-control": "no-store" } });
  const report = body as { buildId?: string; connectionQuality?: string; subscribedTracks?: number; surface?: string; chatPolled?: boolean };
  const session = await recordAttendeeClientHeartbeat({
    eventId,
    sessionId: cookie.slice(firstDot + 1),
    report: {
      buildId: report.buildId,
      connectionQuality: report.connectionQuality as never,
      subscribedTracks: report.subscribedTracks,
      surface: report.surface,
      chatPolled: report.chatPolled,
      userAgent: request.headers.get("user-agent") || undefined,
    },
  }).catch(() => undefined);
  return NextResponse.json({ ok: true, recorded: Boolean(session), buildId: CURRENT_BUILD_ID }, { headers: { "cache-control": "no-store" } });
}
