import { NextResponse } from "next/server";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getMyNetworkingState, joinNetworkingQueue, leaveNetworkingQueue, nextNetworkingMatch, startNetworkingMatchNow } from "@/services/speed-networking/speedNetworkingService";
import { recordAnalyticsEvent } from "@/services/analytics/analyticsEventService";

export const dynamic = "force-dynamic";

/**
 * The attendee's OWN networking state, polled (~5s) by the networking page. Every read runs the
 * matcher, so two people waiting are paired on the next poll of either. Reads only the caller's
 * session; there is no attendeeId parameter.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });
  await ensureRuntimeEvent(eventId);
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  const state = await getMyNetworkingState(eventId, identity?.attendeeId);
  return NextResponse.json({ ok: true, registered: Boolean(identity), attendeeId: identity?.attendeeId || null, ...state }, { headers: { "cache-control": "no-store" } });
}

/** join | start | leave | next | end, for the caller's own entry only. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { eventId?: string; action?: string };
  const eventId = String(body.eventId || "");
  const action = String(body.action || "");
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });
  await ensureRuntimeEvent(eventId);
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  if (!identity) return NextResponse.json({ ok: false, error: "Register for this event before networking.", registered: false }, { status: 403 });
  if (action === "join") {
    await joinNetworkingQueue(eventId, { attendeeId: identity.attendeeId, displayName: identity.displayName, company: identity.company, title: identity.title });
    await recordAnalyticsEvent({ eventId, kind: "networking_joined", subjectId: identity.attendeeId, metadata: { attendeeId: identity.attendeeId, attendeeName: identity.displayName, attendeeCompany: identity.company, queueState: "waiting", source: "networking_page" } }).catch(() => undefined);
  } else if (action === "start") {
    await startNetworkingMatchNow(eventId, identity.attendeeId);
  } else if (action === "next") {
    await nextNetworkingMatch(eventId, identity.attendeeId);
  } else if (action === "leave" || action === "end") {
    await leaveNetworkingQueue(eventId, identity.attendeeId, action === "end" ? "ended" : "left");
  } else return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  const state = await getMyNetworkingState(eventId, identity.attendeeId);
  return NextResponse.json({ ok: true, registered: true, attendeeId: identity.attendeeId, ...state }, { headers: { "cache-control": "no-store" } });
}
