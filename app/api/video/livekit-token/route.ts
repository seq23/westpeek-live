/* eslint-disable @typescript-eslint/no-explicit-any -- boundary adapters normalize legacy/runtime payloads before typed domain use */
import { NextResponse } from "next/server";
import { buildResilientVideoJoinResult } from "@/services/video/livekitRoomUiService";
import { canAttendeeJoinLive, canAttendeePublishLive } from "@/services/venue/attendeeLivePermissionService";
import { authorizeVideoTokenRequest } from "@/lib/auth/videoTokenRequestGuard";
import { currentAttendeeMayHoldPrivilege, getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import type { LiveKitJoinRequest } from "@/types/livekitRoomUi";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { getSpeakerStageState } from "@/services/guests/guestStateService";
import { decideGuestVideoGrant } from "@/services/guests/guestVideoGrants";
import { findActiveMatchForRoom, tokenAllowedForRoom } from "@/services/speed-networking/speedNetworkingService";

/** Rooms anyone holding the link may watch. A green room and a 1:1 networking room never are. */
const WATCHABLE_ROOMS = ["main_stage", "session", "breakout"];

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<LiveKitJoinRequest>;

  if (!body.eventId || !body.roomId || !body.roomType || !body.role) {
    return NextResponse.json({ ok: false, error: "eventId, roomId, roomType, and role are required." }, { status: 400 });
  }
  if (body.role !== "attendee" && !body.displayName) {
    return NextResponse.json({ ok: false, error: "displayName is required for non-attendee video roles." }, { status: 400 });
  }

  const auth = await authorizeVideoTokenRequest({ role: body.role, eventId: body.eventId, allowAnonymousViewer: body.role === "attendee" && WATCHABLE_ROOMS.includes(String(body.roomType)) });
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 403 });

  let displayName = body.displayName;
  let profileId = body.profileId;
  let publishPermission: Awaited<ReturnType<typeof canAttendeePublishLive>> | undefined;

  // The green room is speakers + crew only, and a speaker reaches the main stage only once the
  // crew has brought them there. Attendees can never get a green-room token.
  if (body.roomType === "green_room" || body.role === "speaker") {
    let stageState;
    if (body.role === "speaker") {
      const speaker = await getCurrentGuestIdentity(body.eventId, "speaker");
      if (!speaker) return NextResponse.json({ ok: false, error: "Tell us who you are on the speaker portal before joining a room." }, { status: 403 });
      displayName = speaker.name;
      profileId = speaker.guestId;
      stageState = await getSpeakerStageState(body.eventId, speaker.guestId);
    }
    const grant = decideGuestVideoGrant({ role: body.role as Parameters<typeof decideGuestVideoGrant>[0]["role"], roomType: body.roomType, stageState });
    if (!grant.ok) return NextResponse.json({ ok: false, error: grant.reason, accessStatus: stageState?.status }, { status: 403 });
    publishPermission = { canPublishAudio: grant.canPublish, canPublishVideo: grant.canPublish, canShareScreen: grant.canPublish, reason: grant.reason };
  }

  if (body.role === "attendee") {
    const identity = (auth as any).identity || await getCurrentAttendeeIdentity(body.eventId);
    if (!identity) {
      // No session: a subscribe-only token for the rooms anyone holding the link may watch.
      // Registration is what unlocks taking part, and the venue asks for it at the point of use.
      if (!WATCHABLE_ROOMS.includes(body.roomType)) return NextResponse.json({ ok: false, error: "Register for this event to join this room." }, { status: 403 });
      displayName = "Guest";
      profileId = undefined;
      publishPermission = { canPublishAudio: false, canPublishVideo: false, canShareScreen: false, reason: "Watching only. Register to take part." };
    } else {
    const roomKind = body.roomType === "main_stage" ? "main_stage" : body.roomType === "breakout" ? "breakout" : "session";
    const joinPermission = await canAttendeeJoinLive({ eventId: body.eventId, roomKind, roomId: body.roomId, attendeeId: identity.attendeeId });
    if (!joinPermission.canJoin) return NextResponse.json({ ok: false, error: joinPermission.reason, accessStatus: joinPermission.status }, { status: 403 });
    // No privileged state crosses an unverified email: a session restored on a second device from
    // the address alone may watch and chat, and is issued a watch-only token until the crew approves
    // it here, or the person registers on this device.
    const mayHoldPrivilege = await currentAttendeeMayHoldPrivilege(body.eventId);
    publishPermission = mayHoldPrivilege
      ? await canAttendeePublishLive({ eventId: body.eventId, roomKind, roomId: body.roomId, attendeeId: identity.attendeeId })
      : { canPublishAudio: false, canPublishVideo: false, canShareScreen: false, reason: "You are back on a new device from your email alone. Camera and microphone stay off until the crew approves you here." };
      displayName = identity.displayName;
      profileId = identity.attendeeId;
      // A speed-networking room: only the two attendees of THAT active match, camera and mic on (both opted in).
      if (body.roomType === "speed_networking") {
        const match = await findActiveMatchForRoom(body.eventId, body.roomId).catch(() => undefined);
        if (!tokenAllowedForRoom(match, body.roomId, identity.attendeeId)) return NextResponse.json({ ok: false, error: "This networking room is not yours: tokens go only to the two matched attendees while the match is active." }, { status: 403 });
        publishPermission = { canPublishAudio: true, canPublishVideo: true, canShareScreen: false, reason: "Matched for speed networking." };
      } else {
        const roomKind = body.roomType === "main_stage" ? "main_stage" : body.roomType === "breakout" ? "breakout" : "session";
        const joinPermission = await canAttendeeJoinLive({ eventId: body.eventId, roomKind, roomId: body.roomId, attendeeId: identity.attendeeId });
        if (!joinPermission.canJoin) return NextResponse.json({ ok: false, error: joinPermission.reason, accessStatus: joinPermission.status }, { status: 403 });
        publishPermission = await canAttendeePublishLive({ eventId: body.eventId, roomKind, roomId: body.roomId, attendeeId: identity.attendeeId });
      }
    }
  }

  let result: Awaited<ReturnType<typeof buildResilientVideoJoinResult>>;
  try {
    result = await buildResilientVideoJoinResult({
    eventId: body.eventId,
    roomId: body.roomId,
    roomType: body.roomType,
    displayName: displayName || "Registered attendee",
    role: body.role,
    profileId,
    permissionOverride: publishPermission ? { canPublishAudio: publishPermission.canPublishAudio, canPublishVideo: publishPermission.canPublishVideo, canShareScreen: publishPermission.canShareScreen } : undefined,
    });
  } catch (error) {
    // The grant was allowed; the provider is what failed. Say so with a body the client can show,
    // never an empty 500 (which the room components read as "Unexpected end of JSON input").
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Video provider is not ready.", providerFailure: true }, { status: 503 });
  }

  return NextResponse.json({ ok: true, result, permissions: publishPermission ? { canPublishAudio: publishPermission.canPublishAudio, canPublishVideo: publishPermission.canPublishVideo, canShareScreen: publishPermission.canShareScreen } : undefined });
}
