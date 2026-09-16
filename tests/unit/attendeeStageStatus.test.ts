import { describe, expect, it } from "vitest";
import { decideCapability, defaultLiveControlState, requestedCapability } from "@/services/venue/attendeeLivePermissionService";
import { attendeeStageStatus } from "@/services/venue/attendeeStageStatus";

/**
 * The attendee's state line under the stage player, walked through the real capability
 * transitions the crew drives: request → approve → on stage → revoke, plus decline, permit,
 * closed requests, and the unregistered visitor. The line must never go silent.
 */
const base = { eventId: "room-1", roomKind: "main_stage" as const, roomId: "main-stage", attendeeId: "att-1" };
const control = defaultLiveControlState("room-1", "main_stage", "main-stage");

describe("attendee stage status line", () => {
  it("a fresh Room lets a registered attendee ask for the stage (requests allowed, approval required)", () => {
    const status = attendeeStageStatus({ control, registered: true });
    expect(status.status).toBe("can_request");
    expect(status.primary).toBe("request");
    expect(status.headline).toMatch(/Request to join the stage/);
    expect(status.canPublishVideo).toBe(false);
  });

  it("an unregistered visitor is told to register, not shown a dead end", () => {
    const status = attendeeStageStatus({ control, registered: false });
    expect(status).toMatchObject({ status: "unregistered", primary: "register" });
    expect(status.detail).toMatch(/approval/);
  });

  it("requested → approved → removed, in plain words, with publish flags only while approved", () => {
    const requested = requestedCapability(undefined, base);
    expect(attendeeStageStatus({ control, capability: requested, registered: true })).toMatchObject({ status: "requested", primary: "none", headline: "Requested — waiting for the crew" });

    const approved = decideCapability(requested, { ...base, decision: "approve_publish", actorRole: "crew" });
    const approvedStatus = attendeeStageStatus({ control, capability: approved, registered: true });
    expect(approvedStatus).toMatchObject({ status: "approved", canPublishAudio: true, canPublishVideo: true, primary: "none" });
    expect(approvedStatus.headline).toMatch(/turn on your camera/i);
    expect(approvedStatus.detail).toMatch(/Tap Turn on camera/);
    expect(approvedStatus.detail).not.toMatch(/player above/);

    const revoked = decideCapability(approved, { ...base, decision: "revoke", actorRole: "crew", reason: "Crew removed you from the stage." });
    const removed = attendeeStageStatus({ control, capability: revoked, registered: true });
    expect(removed).toMatchObject({ status: "removed", headline: "Removed by the crew", canPublishAudio: false, canPublishVideo: false, reason: "Crew removed you from the stage." });
  });

  it("declined lets the attendee ask again; permit-to-watch keeps the request button without publishing", () => {
    const declined = decideCapability(requestedCapability(undefined, base), { ...base, decision: "decline", actorRole: "crew" });
    expect(attendeeStageStatus({ control, capability: declined, registered: true })).toMatchObject({ status: "declined", primary: "request" });
    const permitted = decideCapability(undefined, { ...base, decision: "permit", actorRole: "crew" });
    expect(attendeeStageStatus({ control, capability: permitted, registered: true })).toMatchObject({ status: "permitted", primary: "request", canPublishVideo: false });
  });

  it("closed requests are said out loud: kill switch, or camera and mic both off", () => {
    expect(attendeeStageStatus({ control: { ...control, emergencyPublishingDisabled: true }, registered: true })).toMatchObject({ status: "requests_closed", headline: "The crew has closed stage requests for now" });
    expect(attendeeStageStatus({ control: { ...control, globalCameraEnabled: false, globalMicrophoneEnabled: false }, registered: true })).toMatchObject({ status: "requests_closed" });
    // The kill switch also pulls an approved attendee's publish grant.
    const approved = decideCapability(undefined, { ...base, decision: "approve_publish", actorRole: "crew" });
    expect(attendeeStageStatus({ control: { ...control, emergencyPublishingDisabled: true }, capability: approved, registered: true })).toMatchObject({ status: "requests_closed", canPublishVideo: false });
  });

  it("join approval on the room shows the waiting line until the crew permits", () => {
    const gated = { ...control, attendeeJoinRequiresApproval: true };
    expect(attendeeStageStatus({ control: gated, registered: true })).toMatchObject({ status: "waiting_to_watch", primary: "none" });
    const permitted = decideCapability(undefined, { ...base, decision: "permit", actorRole: "crew" });
    expect(attendeeStageStatus({ control: gated, capability: permitted, registered: true }).status).toBe("permitted");
  });
});
