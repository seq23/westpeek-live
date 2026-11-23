import { NextResponse } from "next/server";
import { authorizeVideoTokenRequest } from "@/lib/auth/videoTokenRequestGuard";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { generateZoomMeetingSdkSignature } from "@/services/video/zoomMeetingSdkAuth";
import { signableZoomMeetingNumber } from "@/services/video/backupRoomService";
import { findEventRecord } from "@/services/events/eventRepository";
import type { VideoParticipantRole } from "@/types/video";

const allowedVideoRoles = new Set<VideoParticipantRole>([
  "producer",
  "host",
  "speaker",
  "sponsor",
  "attendee",
  "contractor",
  "client",
  "observer",
]);

function coerceVideoRole(value: unknown, askedForHost: boolean): VideoParticipantRole {
  if (typeof value === "string" && allowedVideoRoles.has(value as VideoParticipantRole)) return value as VideoParticipantRole;
  return askedForHost ? "producer" : "attendee";
}

/**
 * The client names only the event. The server picks the meeting (the event's own Zoom number, else
 * the house number: never the client's) and the Zoom role from who is asking. Zoom role 1 makes the
 * holder the meeting's host (mute, remove, end for all), so a request that asks for it (zoomRole 1,
 * or a host or producer videoRole) needs the live-control rule's go_live for this event: owner, an
 * operator for this event, or a current executive producer, producer or technical director. View-only
 * crew, support and va are refused. Everyone else gets role 0, which only joins this event's own
 * meeting as a participant, the same join every attendee of the event already gets.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const eventId = String(body.eventId ?? "").trim();
    const askedForZoomHost = Number(body.zoomRole ?? 0) === 1;
    const videoRole = coerceVideoRole(body.videoRole, askedForZoomHost);
    const wantsHost = askedForZoomHost || videoRole === "host" || videoRole === "producer";

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required for Zoom fallback authorization." }, { status: 400 });
    }
    const event = await findEventRecord(eventId);
    if (!event || event.id !== eventId) return NextResponse.json({ error: "No such event." }, { status: 404 });

    // An observer (no session) is still signed role 0 for a real event's own meeting: a Zoom signature
    // makes no room and costs nothing, unlike the Daily routes, which refuse observers (23 Nov 2026).
    const auth = wantsHost ? await requireLiveEventControlAccessForRequest(eventId, "go_live") : await authorizeVideoTokenRequest({ role: videoRole, eventId, allowAnonymousViewer: videoRole === "observer" });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: ("status" in auth && auth.status) || 403 });

    const meetingNumber = await signableZoomMeetingNumber(eventId);
    if (!meetingNumber) return NextResponse.json({ error: "This event has no Zoom room set. Add one on the crew deck under Backup rooms." }, { status: 409 });
    const asked = String(body.meetingNumber ?? "").replace(/\s/g, "");
    if (asked && asked !== meetingNumber) return NextResponse.json({ error: "That is not this event's Zoom room." }, { status: 403 });

    const signature = generateZoomMeetingSdkSignature({ meetingNumber, role: wantsHost ? 1 : 0 });

    return NextResponse.json({ ok: true, result: { ...signature, eventId, videoRole } });
  } catch (error) {
    console.error("[zoom-signature] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The Zoom room could not be prepared. Try again in a minute." }, { status: 500 });
  }
}
