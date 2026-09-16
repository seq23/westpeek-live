import { NextResponse } from "next/server";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { getSpeakerCueDeck, getSpeakerLiveCue, getSpeakerStageState } from "@/services/guests/guestStateService";

export const dynamic = "force-dynamic";

/**
 * What the speaker's teleprompter polls (~5s): THEIR approved deck, the live cue, and their stage
 * state. A speaker only ever reads their own; a crew/operator/owner cookie may read any speaker's
 * by ?speakerId=. Attendees and anonymous callers get 403.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });
  let speakerId = "";
  const speaker = await getCurrentGuestIdentity(eventId, "speaker").catch(() => undefined);
  if (speaker) speakerId = speaker.guestId;
  else {
    const control = await requireLiveEventControlAccessForRequest(eventId).catch(() => ({ ok: false as const }));
    if (!control.ok) return NextResponse.json({ ok: false, error: "Speaker identity or crew access required." }, { status: 403 });
    speakerId = url.searchParams.get("speakerId") || "";
    if (!speakerId) return NextResponse.json({ ok: false, error: "speakerId is required for crew reads." }, { status: 400 });
  }
  const [deck, liveCue, stage] = await Promise.all([getSpeakerCueDeck(eventId, speakerId), getSpeakerLiveCue(eventId, speakerId), getSpeakerStageState(eventId, speakerId)]);
  return NextResponse.json({ ok: true, speakerId, approved: deck.approved || null, pendingVersionNumber: deck.pending?.versionNumber || null, liveCue: liveCue?.text ? liveCue : null, stage }, { headers: { "cache-control": "no-store" } });
}
