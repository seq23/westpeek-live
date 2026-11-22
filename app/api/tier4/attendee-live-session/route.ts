import { NextResponse } from "next/server";
import { randomId } from "@/lib/security/portableCrypto";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { ATTENDEE_SESSION_COOKIE } from "@/services/attendees/attendeeSessionService";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { AttendeeSession } from "@/types/attendeeSession";

function sessionCookieValue(eventId: string, sessionId: string) {
  return `${eventId}.${sessionId}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const eventId = String(body.eventId || "");
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });
  const auth = await requireLiveEventControlAccessForRequest(eventId);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status ?? 401 });
  const now = Date.now();
  const attendeeId = String(body.attendeeId || `tier4-attendee-${eventId}`);
  const profile: AttendeeProfile = {
    attendeeId,
    eventId,
    emailHash: `tier4-${attendeeId}`,
    name: String(body.name || "Tier 4 Attendee"),
    emailMasked: "tier4@example.invalid",
    company: String(body.company || "Tier 4 Proof"),
    title: String(body.title || "Event Goer"),
    socialLinks: [],
    topicsOfInterest: ["Live stream consumption proof"],
    role: "attendee",
    status: "active",
    networkingOptIn: false,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  const session: AttendeeSession = {
    sessionId: randomId("tier4-attendee-session"),
    attendeeId,
    eventId,
    role: "attendee",
    status: "active",
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
  };
  const store = getRuntimeStore();
  await store.upsertAttendeeProfile(profile);
  await store.upsertAttendeeSession(session);
  await store.appendStageStreamEvent({
    id: randomId("tier4-attendee-session"),
    eventId,
    stageId: "main-stage",
    signal: "attendee_access_decision",
    nextSource: "LIVEKIT_INGRESS",
    failurePlane: "NONE",
    message: `${auth.actorRole} created Tier 4 attendee session for live-consumption proof: ${attendeeId}`,
    createdAt: new Date().toISOString(),
  }).catch(() => undefined);
  const response = NextResponse.json({ ok: true, attendeeId, sessionId: session.sessionId, cookieName: ATTENDEE_SESSION_COOKIE });
  response.cookies.set(ATTENDEE_SESSION_COOKIE, sessionCookieValue(eventId, session.sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}
