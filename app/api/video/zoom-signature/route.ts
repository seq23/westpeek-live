import { NextResponse } from "next/server";
import { authorizeVideoTokenRequest } from "@/lib/auth/videoTokenRequestGuard";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { generateZoomMeetingSdkSignature } from "@/services/video/zoomMeetingSdkAuth";
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
 * The Zoom role is decided here from who is asking, never from what the client sends. Zoom role 1
 * makes the holder the meeting's host (mute, remove, end for all), so a request that asks for it in
 * any way (zoomRole 1, or a host or producer videoRole) goes through the live-control rule for this
 * event: owner, an operator for this event, or current crew. Everyone else is signed role 0.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const meetingNumber = String(body.meetingNumber ?? "").replace(/\s/g, "");
    const eventId = String(body.eventId ?? "").trim();
    const askedForZoomHost = Number(body.zoomRole ?? body.meetingRole ?? body.role ?? 0) === 1;
    const videoRole = coerceVideoRole(body.videoRole ?? body.participantRole ?? (typeof body.role === "string" ? body.role : undefined), askedForZoomHost);
    const wantsHost = askedForZoomHost || videoRole === "host" || videoRole === "producer";

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required for Zoom fallback authorization." }, { status: 400 });
    }
    if (!meetingNumber || !/^\d{9,12}$/.test(meetingNumber)) {
      return NextResponse.json({ error: "A valid room number is required." }, { status: 400 });
    }

    const auth = wantsHost ? await requireLiveEventControlAccessForRequest(eventId) : await authorizeVideoTokenRequest({ role: videoRole, eventId });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

    const signature = generateZoomMeetingSdkSignature({ meetingNumber, role: wantsHost ? 1 : 0 });

    return NextResponse.json({ ok: true, result: { ...signature, eventId, videoRole } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zoom embedded room could not be prepared.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
