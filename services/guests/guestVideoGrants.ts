import type { LiveKitRoomSurface } from "@/types/livekitRoomUi";
import type { SpeakerStageState } from "@/types/specialGuest";

export type GuestVideoGrant = { ok: true; canPublish: boolean; reason: string } | { ok: false; reason: string };

/**
 * Pure: who may get a LiveKit token for which room.
 *
 *   attendee → never the green room; the stage rules live in attendeeLivePermissionService.
 *   speaker  → the green room always (publish: crew and speakers see and hear each other before
 *              going live); the main stage only once the crew has brought them to the stage.
 *   crew / operator (producer, host) → the green room and the stage, publishing.
 *
 * Exported so the grants are unit-testable without cookies or LiveKit.
 */
export function decideGuestVideoGrant(input: { role: "attendee" | "speaker" | "producer" | "host" | "observer" | "sponsor"; roomType: LiveKitRoomSurface; stageState?: SpeakerStageState }): GuestVideoGrant {
  if (input.roomType === "green_room") {
    if (input.role === "attendee" || input.role === "observer" || input.role === "sponsor") return { ok: false, reason: "The green room is for speakers and crew only." };
    return { ok: true, canPublish: true, reason: input.role === "speaker" ? "Speakers publish in the green room so the crew can see and hear them before they go live." : "Crew publish in the green room." };
  }
  if (input.role === "speaker") {
    const status = input.stageState?.status || "backstage";
    if (input.roomType !== "main_stage") return { ok: false, reason: "Speakers join the green room or the main stage only." };
    if (status === "backstage") return { ok: false, reason: "The crew has not brought you to the stage yet. Wait in the green room." };
    return { ok: true, canPublish: true, reason: status === "invited" ? "The crew brought you to the stage." : "You are on stage." };
  }
  if (input.role === "producer" || input.role === "host") return { ok: true, canPublish: true, reason: "Crew publish on the stage." };
  return { ok: true, canPublish: false, reason: "View only." };
}
