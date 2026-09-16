import { NextResponse } from "next/server";
import { randomId } from "@/lib/security/portableCrypto";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { applyAttendeeLiveDecision, getAttendeeLiveCapability, getAttendeeLiveControlState, setAttendeeLiveCapability } from "@/services/venue/attendeeLivePermissionService";
import type { AttendeeLiveRoomKind } from "@/types/attendeeLive";
import { removeLiveKitParticipantFromMainStage } from "@/services/video/livekitParticipantAdmin";

function bool(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on";
}

function cleanRoomKind(value: unknown): AttendeeLiveRoomKind {
  return value === "breakout" || value === "session" ? value : "main_stage";
}

async function recordDecision(input: { eventId: string; roomId: string; attendeeId: string; actorRole: string; action: string; reason?: string }) {
  await getRuntimeStore().appendStageStreamEvent({
    id: randomId("attendee-live-access"),
    eventId: input.eventId,
    stageId: input.roomId,
    signal: "attendee_access_decision",
    previousSource: undefined,
    nextSource: "LIVEKIT_INGRESS",
    failurePlane: "NONE",
    message: `${input.actorRole} ${input.action} attendee ${input.attendeeId}${input.reason ? `: ${input.reason}` : ""}`,
    createdAt: new Date().toISOString(),
  }).catch(() => undefined);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "event-summit";
  const roomKind = cleanRoomKind(url.searchParams.get("roomKind") || "main_stage");
  const roomId = url.searchParams.get("roomId") || "main-stage";
  const attendeeId = url.searchParams.get("attendeeId") || "";
  const auth = await requireLiveEventControlAccessForRequest(eventId);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  const [control, capability, snapshot] = await Promise.all([
    getAttendeeLiveControlState(eventId, roomKind, roomId),
    attendeeId ? getAttendeeLiveCapability(eventId, roomKind, roomId, attendeeId).catch(() => undefined) : Promise.resolve(undefined),
    getRuntimeStore().readSnapshot().catch(() => undefined),
  ]);
  const logs = (snapshot?.stageStreamEvents || []).filter((event) => event.eventId === eventId && event.stageId === roomId && event.signal === "attendee_access_decision" && (!attendeeId || event.message.includes(attendeeId))).slice(-20);
  return NextResponse.json({ ok: true, control, capability, logs });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const eventId = String(body.eventId || "");
  const attendeeId = String(body.attendeeId || "");
  const roomKind = cleanRoomKind(body.roomKind || "main_stage");
  const roomId = String(body.roomId || "main-stage");
  const action = String(body.action || "permit");
  if (!eventId || !attendeeId) return NextResponse.json({ ok: false, error: "eventId and attendeeId are required." }, { status: 400 });
  const auth = await requireLiveEventControlAccessForRequest(eventId);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  const revoke = action === "revoke" || bool(body.revoked);
  const permit = action === "permit" || action === "repermit" || action === "approve";
  // One-click roster decisions share the server-action rules exactly.
  if (action === "approve_publish" || action === "decline") {
    const capability = await applyAttendeeLiveDecision({ eventId, roomKind, roomId, attendeeId, decision: action, actorRole: auth.actorRole, reason: body.reason ? String(body.reason) : undefined });
    await recordDecision({ eventId, roomId, attendeeId, actorRole: auth.actorRole, action: action === "approve_publish" ? "approved stage publishing (camera + mic) for" : "declined the stage request of" });
    return NextResponse.json({ ok: true, capability });
  }
  const existing = await getAttendeeLiveCapability(eventId, roomKind, roomId, attendeeId).catch(() => undefined);
  const capability = await setAttendeeLiveCapability({
    eventId,
    roomKind,
    roomId,
    attendeeId,
    canJoinLiveStream: permit && !revoke ? true : false,
    canPublishCamera: permit && !revoke ? bool(body.canPublishCamera ?? existing?.canPublishCamera) : false,
    canPublishMicrophone: permit && !revoke ? bool(body.canPublishMicrophone ?? existing?.canPublishMicrophone) : false,
    canShareScreen: permit && !revoke ? bool(body.canShareScreen ?? existing?.canShareScreen) : false,
    approvedForStage: permit && !revoke ? bool(body.approvedForStage ?? existing?.approvedForStage) : false,
    revoked: revoke,
    revokedReason: revoke ? String(body.revokedReason || "Live-event access revoked by crew.") : undefined,
    requestStatus: existing?.requestStatus === "requested" ? (revoke ? "declined" : bool(body.approvedForStage ?? existing?.approvedForStage) ? "approved" : existing.requestStatus) : existing?.requestStatus,
    requestedAt: existing?.requestedAt,
    decidedAt: existing?.requestStatus === "requested" && (revoke || bool(body.approvedForStage ?? existing?.approvedForStage)) ? new Date().toISOString() : existing?.decidedAt,
    updatedBy: auth.actorRole,
    updatedAt: new Date().toISOString(),
  });
  const livekitParticipantRemoval = revoke && roomKind === "main_stage" ? await removeLiveKitParticipantFromMainStage({ eventId, stageId: roomId, attendeeId }).catch((error) => ({ attempted: true, removed: false, status: "failed" as const, message: error instanceof Error ? error.message : "LiveKit participant removal failed." })) : undefined;
  await recordDecision({ eventId, roomId, attendeeId, actorRole: auth.actorRole, action: revoke ? "revoked live access for" : permit ? "permitted live access for" : "updated live access for", reason: revoke ? `${capability.revokedReason || "Crew revoked live access."} LiveKit removal: ${livekitParticipantRemoval?.status || "not_needed"}` : capability.revokedReason });
  return NextResponse.json({ ok: true, capability, livekitParticipantRemoval });
}
