import { NextResponse } from "next/server";
import { currentAttendeeMayHoldPrivilege, getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { getAttendeeLiveCapability, getAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";
import { attendeeStageStatus } from "@/services/venue/attendeeStageStatus";

export const dynamic = "force-dynamic";

/**
 * The attendee's OWN stage status, polled (~5s) by the stage panel and the on-stage control bar:
 * the plain-words state line and whether they may publish camera / mic right now. Reads only the
 * caller's own capability from their session cookie; there is no attendeeId parameter, so one
 * attendee can never read another's. Unregistered callers get the "unregistered" state, not an error.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  const roomId = url.searchParams.get("roomId") || "main-stage";
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });
  const identity = await getCurrentAttendeeIdentity(eventId).catch(() => undefined);
  const control = await getAttendeeLiveControlState(eventId, "main_stage", roomId);
  // Stage permission is device-bound. A session restored from an email alone is registered and
  // nothing more, so it reads its own state as "no capability" rather than inheriting an approval.
  const mayHoldPrivilege = identity ? await currentAttendeeMayHoldPrivilege(eventId) : false;
  const capability = identity && mayHoldPrivilege ? await getAttendeeLiveCapability(eventId, "main_stage", roomId, identity.attendeeId).catch(() => undefined) : undefined;
  const status = attendeeStageStatus({ control, capability, registered: Boolean(identity) });
  return NextResponse.json({ ok: true, attendeeId: identity?.attendeeId || null, ...status, updatedAt: capability?.updatedAt || control.updatedAt }, { headers: { "cache-control": "no-store" } });
}
