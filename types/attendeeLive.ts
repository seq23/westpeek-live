export type AttendeeLiveRoomKind = "main_stage" | "breakout" | "session";
export type AttendeeLiveRequestStatus = "disabled" | "available" | "requested" | "approved" | "live" | "revoked";

export interface AttendeeLiveCapability {
  eventId: string;
  attendeeId: string;
  roomKind: AttendeeLiveRoomKind;
  roomId: string;
  canJoinLiveStream: boolean;
  canPublishCamera: boolean;
  canPublishMicrophone: boolean;
  canShareScreen: boolean;
  approvedForStage: boolean;
  revoked: boolean;
  revokedReason?: string;
  /**
   * The attendee's stage request, if any. "requested" is the pending queue the crew
   * approves or declines from the roster; approve grants camera/mic on the stage.
   */
  requestStatus?: AttendeeLiveRequestDecision;
  requestedAt?: string;
  decidedAt?: string;
  updatedBy?: string;
  updatedAt: string;
}

export type AttendeeLiveRequestDecision = "requested" | "approved" | "declined";

/** One-click crew decisions on the roster. Each is a total function of the previous capability. */
export type AttendeeLiveDecision = "permit" | "approve_publish" | "revoke" | "decline" | "reset";

export interface AttendeeLiveControlState {
  eventId: string;
  roomKind: AttendeeLiveRoomKind;
  roomId: string;
  globalCameraEnabled: boolean;
  globalMicrophoneEnabled: boolean;
  globalScreenShareEnabled: boolean;
  requestRequired: boolean;
  attendeeJoinRequiresApproval: boolean;
  emergencyPublishingDisabled: boolean;
  updatedAt: string;
}
