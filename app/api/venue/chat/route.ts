import { NextResponse } from "next/server";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getLiveChatPosterClass } from "@/lib/auth/liveChatPoster";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { listLiveRoomChatDelta } from "@/services/venue/liveChatService";
import type { LiveChatRoomKind } from "@/types/liveChat";

export const dynamic = "force-dynamic";

function roomKindOf(value: string | null): LiveChatRoomKind {
  return value === "breakout" || value === "session" ? value : "main_stage";
}

/**
 * The chat delta, polled (~4s) by every open room. It answers with what changed since the caller's
 * cursor — new messages, and the ids that left this viewer's room because the crew hid them or
 * cleared the room — never the whole window again, so a room of five hundred costs one small
 * response per person per poll instead of a full refetch.
 *
 * Fails soft: a store that cannot be read answers ok:false and the open page keeps what it has
 * (and the server-rendered shell has already rendered its own "unavailable" card through
 * SafeSection). Nothing here is a write.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  const roomKind = roomKindOf(url.searchParams.get("roomKind"));
  const roomId = url.searchParams.get("roomId") || "";
  const since = url.searchParams.get("since") || undefined;
  if (!eventId || !roomId) return NextResponse.json({ ok: false, error: "eventId and roomId are required." }, { status: 400 });
  try {
    const [crewAuth, identity, posterClass] = await Promise.all([
      requireLiveEventControlAccessForRequest(eventId).catch(() => ({ ok: false as const })),
      getCurrentAttendeeIdentity(eventId).catch(() => undefined),
      getLiveChatPosterClass(eventId).catch(() => "attendee" as const),
    ]);
    const delta = await listLiveRoomChatDelta({ eventId, roomKind, roomId, since, viewer: crewAuth.ok ? "crew" : "attendee", attendeeId: identity?.attendeeId, posterClass });
    return NextResponse.json({ ok: true, ...delta }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Live chat is unavailable right now." }, { headers: { "cache-control": "no-store" } });
  }
}
