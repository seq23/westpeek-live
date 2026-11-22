import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyVideoProvider } from "@/services/video";

describe("Daily provider implementation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates Daily rooms and meeting tokens without exposing the API key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer daily_test_secret");

      if (url.endsWith("/rooms")) {
        return new Response(JSON.stringify({ name: "event-1-main-stage", url: "https://westpeeklive.daily.co/event-1-main-stage" }), { status: 200 });
      }

      if (url.endsWith("/meeting-tokens")) {
        return new Response(JSON.stringify({ token: "daily-meeting-token" }), { status: 200 });
      }

      return new Response("not found", { status: 404 });
    });

    const provider = new DailyVideoProvider({
      apiKey: "daily_test_secret",
      apiBaseUrl: "https://api.daily.co/v1",
      domain: "westpeeklive.daily.co",
      fallbackEnabled: true,
    });

    const room = await provider.createRoom({
      agencyId: "agency-1",
      eventId: "event-1",
      provider: "daily",
      roomType: "main_stage",
      label: "Main Stage",
    });

    expect(room.provider).toBe("daily");
    expect(room.joinUrl).toBe("https://westpeeklive.daily.co/event-1-main-stage");

    const token = await provider.createParticipantToken({
      roomId: room.providerRoomId ?? room.id,
      eventId: "event-1",
      displayName: "Producer",
      role: "producer",
      canPublishAudio: true,
      canPublishVideo: true,
      canShareScreen: true,
      expiresInSeconds: 3600,
    });

    expect(token.provider).toBe("daily");
    expect(token.token).toBe("daily-meeting-token");
    expect(token.token).not.toContain("daily_test_secret");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when Daily configuration is invalid", () => {
    expect(
      () =>
        new DailyVideoProvider({
          apiKey: "",
          apiBaseUrl: "https://api.daily.co/v1",
          domain: "westpeeklive.daily.co",
          fallbackEnabled: true,
        }),
    ).toThrow("DAILY_API_KEY is required");
  });

  it("reuses an existing Daily room when Daily reports the room already exists", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/rooms") && method === "POST") {
        return new Response(JSON.stringify({ error: "room already exists" }), { status: 400 });
      }

      if (url.includes("/rooms/event-1-main-stage")) {
        return new Response(JSON.stringify({ name: "event-1-main-stage", url: "https://westpeeklive.daily.co/event-1-main-stage" }), { status: 200 });
      }

      return new Response("not found", { status: 404 });
    });

    const provider = new DailyVideoProvider({
      apiKey: "daily_test_secret",
      apiBaseUrl: "https://api.daily.co/v1",
      domain: "westpeeklive.daily.co",
      fallbackEnabled: true,
    });

    const room = await provider.createRoom({
      agencyId: "agency-1",
      eventId: "event-1",
      provider: "daily",
      roomType: "main_stage",
      label: "Main Stage",
    });

    expect(room.providerRoomId).toBe("event-1-main-stage");
    expect(room.joinUrl).toBe("https://westpeeklive.daily.co/event-1-main-stage");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  const provider = () => new DailyVideoProvider({ apiKey: "daily_test_secret", apiBaseUrl: "https://api.daily.co/v1", domain: "westpeeklive.daily.co", fallbackEnabled: true });
  const input = { agencyId: "agency-1", eventId: "event-1", provider: "daily" as const, roomType: "main_stage" as const, label: "Main Stage" };

  it("a 400 with no room behind it is the original error, not a reused room", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/rooms") && init?.method === "POST") return new Response(JSON.stringify({ error: "invalid-request-error", info: "properties.exp is invalid" }), { status: 400 });
      return new Response(JSON.stringify({ error: "not-found" }), { status: 404 });
    });
    await expect(provider().createRoom(input)).rejects.toThrow(/400.*properties\.exp is invalid/);
  });

  it("an auth failure that mentions 'already exists' is never read as a name clash", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ error: "authentication-error", info: "key for a room that already exists was revoked" }), { status: 401 }));
    await expect(provider().createRoom(input)).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
