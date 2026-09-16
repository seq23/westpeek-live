import type { LiveKitJoinRequest, LiveKitJoinResult, LiveKitRoomUiState } from "@/types/livekitRoomUi";
import type { VideoRoomType } from "@/types/video";
import { buildDefaultTokenPermissions, createVideoRoom, createVideoRoomToken, getVideoFallbackPolicy } from "@/services/video";
import { normalizeLiveKitRoomName } from "@/services/video/livekitRoomNaming";

export function mapRoomSurfaceToVideoRoomType(surface: LiveKitJoinRequest["roomType"]): VideoRoomType {
  if (surface === "main_stage") return "main_stage";
  if (surface === "green_room") return "green_room";
  if (surface === "backstage") return "backstage";
  if (surface === "testing") return "testing";
  if (surface === "breakout") return "breakout";
  if (surface === "sponsor_booth") return "sponsor_booth";
  return "speed_networking";
}

export function buildLiveKitRoomLabel(input: Pick<LiveKitJoinRequest, "roomType" | "eventId">) {
  return `${input.eventId} ${input.roomType.replace(/_/g, " ")}`;
}

export async function buildLiveKitJoinResult(input: LiveKitJoinRequest): Promise<LiveKitJoinResult> {
  const permissions = input.permissionOverride || buildDefaultTokenPermissions(input.role);
  const room = await createVideoRoom({
    agencyId: input.agencyId ?? `event-${input.eventId}-agency`,
    eventId: input.eventId,
    provider: "livekit",
    roomType: mapRoomSurfaceToVideoRoomType(input.roomType),
    label: buildLiveKitRoomLabel(input),
    recordingEnabled: input.roomType === "main_stage",
  });

  const livekitUrl = typeof room.metadata.livekitUrl === "string" ? room.metadata.livekitUrl : undefined;
  // The stage room is the ingress-backed room; the green room is one deterministic room per event
  // so crew and speakers land in the same place from any page.
  const ingressBackedRoomName = input.roomType === "main_stage" ? normalizeLiveKitRoomName(input.eventId, input.roomId || "main-stage") : input.roomType === "green_room" ? normalizeLiveKitRoomName(input.eventId, "green-room") : undefined;
  const tokenRoom = ingressBackedRoomName ? {
    ...room,
    id: ingressBackedRoomName,
    providerRoomId: ingressBackedRoomName,
    joinUrl: livekitUrl ? `${livekitUrl.replace("wss://", "https://")}/rooms/${ingressBackedRoomName}` : room.joinUrl,
    backstageUrl: livekitUrl ? `${livekitUrl.replace("wss://", "https://")}/rooms/${ingressBackedRoomName}/backstage` : room.backstageUrl,
  } : room;
  const token = await createVideoRoomToken("livekit", {
    roomId: tokenRoom.providerRoomId ?? tokenRoom.id,
    eventId: input.eventId,
    displayName: input.displayName,
    profileId: input.profileId,
    role: input.role,
    expiresInSeconds: 60 * 60,
    ...permissions,
  });

  return {
    room: tokenRoom,
    token,
    livekitUrl,
    connectionState: "token_ready",
  };
}


export async function buildResilientVideoJoinResult(input: LiveKitJoinRequest): Promise<LiveKitJoinResult> {
  try {
    return await buildLiveKitJoinResult(input);
  } catch (error) {
    const policy = getVideoFallbackPolicy();
    if (!policy.dailyAutomaticFallbackEnabled) {
      throw error;
    }

    const permissions = input.permissionOverride || buildDefaultTokenPermissions(input.role);
    const room = await createVideoRoom({
      agencyId: input.agencyId ?? `event-${input.eventId}-agency`,
      eventId: input.eventId,
      provider: "daily",
      roomType: mapRoomSurfaceToVideoRoomType(input.roomType),
      label: buildLiveKitRoomLabel(input),
      recordingEnabled: false,
      metadata: {
        fallbackFrom: "livekit",
        fallbackReason: error instanceof Error ? error.message : "LiveKit join setup failed.",
        automaticFallback: true,
      },
    });

    const token = await createVideoRoomToken("daily", {
      roomId: room.providerRoomId ?? room.id,
      eventId: input.eventId,
      displayName: input.displayName,
      profileId: input.profileId,
      role: input.role,
      expiresInSeconds: 60 * 60,
      ...permissions,
    });

    return {
      room,
      token,
      livekitUrl: undefined,
      dailyUrl: room.joinUrl ? `${room.joinUrl}${room.joinUrl.includes("?") ? "&" : "?"}t=${encodeURIComponent(token.token)}` : undefined,
      fallbackApplied: true,
      fallbackProvider: "daily",
      fallbackReason: error instanceof Error ? error.message : "LiveKit join setup failed.",
      connectionState: "token_ready",
    };
  }
}

export function buildLiveKitRoomUiState(input: {
  eventId: string;
  roomId: string;
  roomType: LiveKitJoinRequest["roomType"];
  role: LiveKitJoinRequest["role"];
  activeParticipantCount?: number;
  reconnectAttempts?: number;
}): LiveKitRoomUiState {
  const permissions = buildDefaultTokenPermissions(input.role);

  return {
    eventId: input.eventId,
    roomId: input.roomId,
    roomType: input.roomType,
    connectionState: "not_connected",
    activeParticipantCount: input.activeParticipantCount ?? 0,
    reconnectAttempts: input.reconnectAttempts ?? 0,
    ...permissions,
  };
}
