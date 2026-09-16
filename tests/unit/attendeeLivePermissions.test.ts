import { describe, expect, it } from "vitest";
import { defaultLiveControlState } from "@/services/venue/attendeeLivePermissionService";

describe("attendee live permission defaults", () => {
  it("main stage allows attendee camera/mic requests by default, with crew approval required before publishing", () => {
    const state = defaultLiveControlState("event-summit", "main_stage", "main-stage");
    expect(state.globalCameraEnabled).toBe(true);
    expect(state.globalMicrophoneEnabled).toBe(true);
    expect(state.requestRequired).toBe(true);
    expect(state.emergencyPublishingDisabled).toBe(false);
  });

  it("allows breakout camera and microphone by room policy while screen share stays off", () => {
    const state = defaultLiveControlState("event-summit", "breakout", "general-breakout");
    expect(state.globalCameraEnabled).toBe(true);
    expect(state.globalMicrophoneEnabled).toBe(true);
    expect(state.globalScreenShareEnabled).toBe(false);
  });
});
