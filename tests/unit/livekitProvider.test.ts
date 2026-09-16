import { describe, expect, it } from "vitest";
import { createLiveKitAccessToken, LiveKitVideoProvider } from "@/services/video";

describe("LiveKit provider implementation", () => {
  it("creates a signed LiveKit access token without exposing the secret", () => {
    const token = createLiveKitAccessToken({
      env: {
        apiKey: "dev-key",
        apiSecret: "dev-secret",
      },
      roomName: "event-1-main-stage",
      request: {
        roomId: "event-1-main-stage",
        eventId: "event-1",
        displayName: "Producer",
        role: "producer",
        canPublishAudio: true,
        canPublishVideo: true,
        canShareScreen: true,
        expiresInSeconds: 3600,
      },
    });

    expect(token.token.split(".")).toHaveLength(3);
    expect(token.token).not.toContain("dev-secret");
    // The identity is never the display name: LiveKit disconnects whoever already holds an
    // identity, so two "Producer"s would displace each other and leave a ghost tile behind.
    expect(token.participantIdentity).not.toBe("producer");
    expect(token.participantIdentity).toMatch(/^anon-/);
  });

  it("creates LiveKit rooms and participant tokens", async () => {
    const provider = new LiveKitVideoProvider({
      livekitUrl: "wss://agency-event-os-dev.livekit.cloud",
      apiKey: "dev-key",
      apiSecret: "dev-secret",
    });

    const room = await provider.createRoom({
      agencyId: "agency-1",
      eventId: "event-1",
      provider: "livekit",
      roomType: "main_stage",
      label: "Main Stage",
      recordingEnabled: true,
    });

    expect(room.provider).toBe("livekit");
    expect(room.providerRoomId).toContain("event-1-main-stage-main-stage");

    const token = await provider.createParticipantToken({
      roomId: room.providerRoomId ?? room.id,
      eventId: "event-1",
      displayName: "Host",
      role: "host",
      canPublishAudio: true,
      canPublishVideo: true,
      canShareScreen: true,
      expiresInSeconds: 900,
    });

    expect(token.provider).toBe("livekit");
    expect(token.token.split(".")).toHaveLength(3);
  });

  it("rejects invalid LiveKit URL format", () => {
    expect(
      () =>
        new LiveKitVideoProvider({
          livekitUrl: "https://bad.example.com",
          apiKey: "dev-key",
          apiSecret: "dev-secret",
        }),
    ).toThrow("LIVEKIT_URL must start with wss://");
  });
});
