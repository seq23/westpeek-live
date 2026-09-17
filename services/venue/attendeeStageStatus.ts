import type { AttendeeLiveCapability, AttendeeLiveControlState } from "@/types/attendeeLive";
import { evaluateAttendeeLiveAccess } from "@/services/venue/attendeeLivePermissionService";

/**
 * The one state line an attendee sees under the stage player, in plain words, with the one
 * primary action that goes with it. Pure: the stage panel renders it, /api/attendee-live/mine
 * serves it to the polling client, and the unit tests walk every transition.
 */
export type AttendeeStageStatusKind =
  | "unregistered"
  | "waiting_to_watch"
  | "removed"
  | "approved"
  | "requested"
  | "declined"
  | "requests_closed"
  | "permitted"
  | "can_request";

export interface AttendeeStageStatus {
  status: AttendeeStageStatusKind;
  headline: string;
  detail: string;
  /** The one button. `request` renders the request form; none otherwise. There is deliberately no
   * `register` primary: the page's single register card owns that ask, and the raise-hand control
   * folds its own ask open only when an unregistered person presses it. */
  primary: "request" | "none";
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  reason?: string;
}

export function attendeeStageStatus(input: { control: AttendeeLiveControlState; capability?: AttendeeLiveCapability; registered: boolean }): AttendeeStageStatus {
  const { control, capability, registered } = input;
  const none = { canPublishAudio: false, canPublishVideo: false };
  // Watching is open to everyone. Registering is only what lets a person take part. This line is
  // NOT a second register pitch: the page carries exactly one register card (RegisterToTakePart),
  // so the raise-hand control here only explains what asking to speak needs, and the ask itself
  // appears when the person presses it. `primary: "none"` is what keeps the second button away.
  if (!registered) return { status: "unregistered", headline: "Want to speak? Ask the crew to bring you on stage", detail: "The crew sees your request on their roster and approves it when it is your moment. Watching needs nothing; asking to speak needs your name, email and company.", primary: "none", ...none };
  const access = evaluateAttendeeLiveAccess({ control, capability, roomKind: "main_stage" });
  if (access.status === "revoked") return { status: "removed", headline: "Removed by the crew", detail: access.reason, primary: "none", reason: access.reason, ...none };
  if (!access.canJoin) return { status: "waiting_to_watch", headline: "Waiting for the crew to let you in", detail: "The crew is permitting people into the live stage one by one. Stay on this page; it updates on its own.", primary: "none", ...none };
  if (capability?.approvedForStage && !control.emergencyPublishingDisabled) {
    const canPublishVideo = control.globalCameraEnabled && capability.canPublishCamera;
    const canPublishAudio = control.globalMicrophoneEnabled && capability.canPublishMicrophone;
    if (canPublishVideo || canPublishAudio) return { status: "approved", headline: "Approved — turn on your camera or mic below", detail: `The crew approved you for the stage. Tap Turn on camera${canPublishAudio ? " or Turn on microphone" : ""} below; nothing goes live until you do. The crew can remove you at any time.`, primary: "none", canPublishAudio, canPublishVideo };
  }
  if (capability?.requestStatus === "requested") return { status: "requested", headline: "Requested — waiting for the crew", detail: "Your request is in the crew's queue. Keep watching; this line changes the moment they decide.", primary: "none", ...none };
  if (control.emergencyPublishingDisabled) return { status: "requests_closed", headline: "The crew has closed stage requests for now", detail: "Attendee cameras and microphones are paused during live operations. Chat stays open.", primary: "none", ...none };
  if (!control.globalCameraEnabled && !control.globalMicrophoneEnabled) return { status: "requests_closed", headline: "The crew has closed stage requests for now", detail: "The crew has turned off attendee camera and microphone requests for this room. You can still watch and chat.", primary: "none", ...none };
  if (capability?.requestStatus === "declined") return { status: "declined", headline: "The crew declined your last request", detail: "You can ask again if the moment changes.", primary: "request", ...none };
  if (capability?.canJoinLiveStream) return { status: "permitted", headline: "You're in. Want to speak? Request to join the stage", detail: "The crew let you into the live stage. Ask to join when you have something to say; the crew can revoke or restore access at any time.", primary: "request", ...none };
  return { status: "can_request", headline: "Want to speak? Request to join the stage", detail: "The crew sees your request on their roster and approves it when it is your moment. Approval means you can turn on your camera and mic from here.", primary: "request", ...none };
}
