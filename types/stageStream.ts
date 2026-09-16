export type StageStreamSource = "LIVEKIT_INGRESS" | "CLOUDFLARE_STREAM" | "DAILY" | "ZOOM" | "GOOGLE_MEET";
export type ProducerStudioSource = "STREAMYARD" | "CLOUDFLARE_STREAM" | "DAILY" | "ZOOM" | "GOOGLE_MEET" | "UNKNOWN";
export type StreamFailurePlane = "NONE" | "STREAMYARD_FEED" | "LIVEKIT_DISTRIBUTION" | "CLOUDFLARE_STREAM" | "DAILY_FALLBACK" | "ZOOM_FALLBACK" | "GOOGLE_MEET_ESCALATION" | "PRIMARY_PIPELINE_TOTAL_FAILURE" | "UNKNOWN";
export type StageFallbackMode = "AUTO_RECOMMENDED" | "AUTO_SWITCHED" | "MANUAL_REQUIRED" | "MANUAL_OVERRIDE";
export type StageStreamStatus =
  | "GENERATING_CREDENTIALS"
  | "READY_FOR_STREAMYARD"
  | "STREAMYARD_CONNECTED"
  | "LIVEKIT_INGRESS_LIVE"
  | "LIVEKIT_DEGRADED"
  | "STREAMYARD_FEED_LOST"
  | "SWITCHING_TO_CLOUDFLARE_STREAM"
  | "CLOUDFLARE_STREAM_LIVE"
  | "SWITCHING_TO_DAILY"
  | "DAILY_LIVE"
  | "SWITCHING_TO_ZOOM"
  | "ZOOM_LIVE"
  | "SWITCHING_TO_GOOGLE_MEET"
  | "GOOGLE_MEET_LIVE"
  | "ENDED"
  | "ERROR_SAFE";

export type StageStreamSignal =
  | "generate_credentials"
  | "ingress_started"
  | "ingress_ended"
  | "livekit_room_unreachable"
  | "livekit_token_failure"
  | "attendee_livekit_disconnect_after_started"
  | "manual_switch_to_cloudflare_stream"
  | "cloudflare_stream_live"
  | "cloudflare_stream_failed"
  | "manual_switch_to_daily"
  | "daily_failed"
  | "move_production_to_daily"
  | "manual_switch_to_zoom"
  | "zoom_failed"
  | "manual_switch_to_google_meet"
  | "operator_mark_show_ended"
  | "operator_reset_primary"
  | "attendee_access_decision"
  | "operator_rollback_to_livekit"
  | "operator_rollback_to_cloudflare_stream"
  | "operator_rollback_to_daily";

export interface StageStreamState {
  eventId: string;
  stageId: string;
  activeStreamSource: StageStreamSource;
  producerStudioSource: ProducerStudioSource;
  streamStatus: StageStreamStatus;
  failurePlane: StreamFailurePlane;
  fallbackMode: StageFallbackMode;
  livekitRoomName?: string;
  livekitIngressId?: string;
  livekitIngressUrl?: string;
  livekitStreamKey?: string;
  cloudflareStreamPlaybackUrl?: string;
  cloudflareStreamLiveInputId?: string;
  dailyRoomName?: string;
  dailyRoomUrl?: string;
  zoomMeetingNumber?: string;
  googleMeetFallbackUrl?: string;
  hasEverStarted: boolean;
  operatorMarkedShowEnded: boolean;
  manualFallbackDisabled: boolean;
  mainStageAttendeeJoinEnabled: boolean;
  breakoutAttendeeCameraEnabled: boolean;
  lastWebhookEvent?: string;
  lastWebhookAt?: string;
  lastHealthCheckAt?: string;
  /** The last reason LiveKit refused to mint credentials, so the console can say it instead of spinning. */
  lastProvisionError?: string;
  fallbackReason?: string;
  fallbackRecommendation?: string;
  fallbackActivatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StageStreamEvent {
  id: string;
  eventId: string;
  stageId: string;
  signal: StageStreamSignal;
  previousSource?: StageStreamSource;
  nextSource: StageStreamSource;
  failurePlane: StreamFailurePlane;
  message: string;
  createdAt: string;
}

export interface PublicStageStreamState {
  eventId: string;
  stageId: string;
  activeStreamSource: StageStreamSource;
  producerStudioSource: ProducerStudioSource;
  streamStatus: StageStreamStatus;
  failurePlane: StreamFailurePlane;
  fallbackMode: StageFallbackMode;
  hasEverStarted: boolean;
  mainStageAttendeeJoinEnabled: boolean;
  breakoutAttendeeCameraEnabled: boolean;
  cloudflareStreamPlaybackUrl?: string;
  zoomMeetingNumber?: string;
  googleMeetFallbackUrl?: string;
  fallbackReason?: string;
  fallbackRecommendation?: string;
  updatedAt: string;
}

export interface OperatorStageStreamState extends PublicStageStreamState {
  livekitRoomName?: string;
  livekitIngressId?: string;
  livekitIngressUrl?: string;
  livekitStreamKey?: string;
  cloudflareStreamLiveInputId?: string;
  dailyRoomName?: string;
  dailyRoomUrl?: string;
  zoomMeetingNumber?: string;
  lastWebhookEvent?: string;
  lastWebhookAt?: string;
  lastHealthCheckAt?: string;
  /** The last reason LiveKit refused to mint credentials, so the console can say it instead of spinning. */
  lastProvisionError?: string;
  operatorMarkedShowEnded: boolean;
  manualFallbackDisabled: boolean;
}

export function toPublicStageStreamState(state: StageStreamState): PublicStageStreamState {
  return {
    eventId: state.eventId,
    stageId: state.stageId,
    activeStreamSource: state.activeStreamSource,
    producerStudioSource: state.producerStudioSource,
    streamStatus: state.streamStatus,
    failurePlane: state.failurePlane,
    fallbackMode: state.fallbackMode,
    hasEverStarted: state.hasEverStarted,
    mainStageAttendeeJoinEnabled: state.mainStageAttendeeJoinEnabled,
    breakoutAttendeeCameraEnabled: state.breakoutAttendeeCameraEnabled,
    cloudflareStreamPlaybackUrl: state.cloudflareStreamPlaybackUrl,
    zoomMeetingNumber: state.zoomMeetingNumber,
    googleMeetFallbackUrl: state.googleMeetFallbackUrl,
    fallbackReason: state.fallbackReason,
    fallbackRecommendation: state.fallbackRecommendation,
    updatedAt: state.updatedAt,
  };
}

export function toOperatorStageStreamState(state: StageStreamState): OperatorStageStreamState {
  return {
    ...toPublicStageStreamState(state),
    livekitRoomName: state.livekitRoomName,
    livekitIngressId: state.livekitIngressId,
    livekitIngressUrl: state.livekitIngressUrl,
    livekitStreamKey: state.livekitStreamKey,
    cloudflareStreamLiveInputId: state.cloudflareStreamLiveInputId,
    dailyRoomName: state.dailyRoomName,
    dailyRoomUrl: state.dailyRoomUrl,
    zoomMeetingNumber: state.zoomMeetingNumber,
    lastWebhookEvent: state.lastWebhookEvent,
    lastWebhookAt: state.lastWebhookAt,
    lastHealthCheckAt: state.lastHealthCheckAt,
    lastProvisionError: state.lastProvisionError,
    operatorMarkedShowEnded: state.operatorMarkedShowEnded,
    manualFallbackDisabled: state.manualFallbackDisabled,
  };
}
