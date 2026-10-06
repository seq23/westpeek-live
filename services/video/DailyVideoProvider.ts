import type { VideoProvider } from "./VideoProvider";
import type {
  CreateVideoRoomInput,
  VideoProviderHealth,
  VideoRoom,
  VideoRoomToken,
  VideoRoomTokenRequest,
} from "@/types/video";
import { getDailyEnv } from "@/lib/env";

export interface DailyVideoProviderConfig {
  apiKey: string;
  apiBaseUrl: string;
  domain: string;
  fallbackEnabled: boolean;
}

interface DailyRoomResponse {
  id?: string;
  name?: string;
  url?: string;
}

interface DailyMeetingTokenResponse {
  token?: string;
}

function stableRoomName(input: Pick<CreateVideoRoomInput, "eventId" | "roomType" | "label">) {
  return `${input.eventId}-${input.roomType}-${input.label}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 128);
}

function normalizeDailyBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function normalizeDailyApiKey(value: string) {
  return value.trim().replace(/^Bearer\s+/i, "").trim();
}

function addDailyTokenToUrl(roomUrl: string, token: string) {
  const separator = roomUrl.includes("?") ? "&" : "?";
  return `${roomUrl}${separator}t=${encodeURIComponent(token)}`;
}

export class DailyVideoProvider implements VideoProvider {
  readonly key = "daily";

  constructor(private readonly config: DailyVideoProviderConfig) {
    if (!config.apiKey) throw new Error("DAILY_API_KEY is required for Daily fallback.");
    if (!config.apiBaseUrl.startsWith("https://")) throw new Error("DAILY_API_BASE_URL must start with https://");
    if (!config.domain) throw new Error("DAILY_DOMAIN is required for Daily fallback.");
  }

  private async dailyFetch<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${normalizeDailyBaseUrl(this.config.apiBaseUrl)}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeDailyApiKey(this.config.apiKey)}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Daily API request failed: ${response.status} ${body}`);
    }

    return (await response.json()) as T;
  }

  private async getRoom(providerRoomId: string): Promise<DailyRoomResponse> {
    return this.dailyFetch<DailyRoomResponse>(`/rooms/${encodeURIComponent(providerRoomId)}`, {
      method: "GET",
    });
  }

  private async createOrGetRoom(input: CreateVideoRoomInput, providerRoomId: string): Promise<DailyRoomResponse> {
    try {
      return await this.dailyFetch<DailyRoomResponse>("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: providerRoomId,
          privacy: "private",
          properties: {
            enable_screenshare: true,
            enable_chat: true,
            start_video_off: input.roomType !== "main_stage",
            start_audio_off: input.roomType === "main_stage" ? false : true,
            eject_at_room_exp: true,
          },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const roomAlreadyExists = message.includes("already") || message.includes("exists") || message.includes("400") || message.includes("409");

      if (!roomAlreadyExists) {
        throw error;
      }

      return this.getRoom(providerRoomId);
    }
  }

  async createRoom(input: CreateVideoRoomInput): Promise<VideoRoom> {
    const providerRoomId = stableRoomName(input);
    const response = await this.createOrGetRoom(input, providerRoomId);

    const roomName = response.name || providerRoomId;
    const joinUrl = response.url || `https://${this.config.domain}/${roomName}`;

    return {
      id: roomName,
      agencyId: input.agencyId,
      clientId: input.clientId,
      eventId: input.eventId,
      provider: "daily",
      providerRoomId: roomName,
      roomType: input.roomType,
      label: input.label,
      status: "provisioned",
      joinUrl,
      backstageUrl: joinUrl,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      recordingEnabled: input.recordingEnabled ?? false,
      metadata: {
        ...(input.metadata ?? {}),
        dailyDomain: this.config.domain,
        fallbackProvider: "daily",
        fallbackAutomatic: true,
      },
    };
  }

  async closeRoom(room: VideoRoom): Promise<VideoRoom> {
    return {
      ...room,
      status: "closed",
    };
  }

  async createParticipantToken(request: VideoRoomTokenRequest): Promise<VideoRoomToken> {
    const response = await this.dailyFetch<DailyMeetingTokenResponse>("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: request.roomId,
          user_name: request.displayName,
          is_owner: request.role === "producer" || request.role === "host",
          exp: Math.floor(Date.now() / 1000) + request.expiresInSeconds,
          enable_screenshare: request.canShareScreen,
        },
      }),
    });

    if (!response.token) {
      throw new Error("Daily meeting token response did not include a token.");
    }

    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1000).toISOString();

    return {
      token: response.token,
      provider: "daily",
      roomId: request.roomId,
      participantIdentity: request.profileId ?? `${request.role}-${request.displayName}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      expiresAt,
    };
  }

  async getRoomHealth(room: VideoRoom): Promise<VideoProviderHealth> {
    return {
      provider: "daily",
      ok: this.config.fallbackEnabled && Boolean(this.config.apiKey && this.config.domain && room.provider === "daily"),
      details: [
        this.config.fallbackEnabled ? "Daily automatic fallback is enabled." : "Daily automatic fallback is disabled by backend setting.",
        "Daily provider configuration is present and server-side only.",
      ],
    };
  }

  buildJoinUrl(room: VideoRoom, token: VideoRoomToken) {
    if (!room.joinUrl) return undefined;
    return addDailyTokenToUrl(room.joinUrl, token.token);
  }
}

export function createDailyProviderFromEnv(env = process.env) {
  const daily = getDailyEnv({
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    AUTH_SESSION_COOKIE_NAME: env.AUTH_SESSION_COOKIE_NAME || "agency_event_os_session",
    RESEND_API_KEY: env.RESEND_API_KEY || "",
    EMAIL_FROM: env.EMAIL_FROM || "",
    EMAIL_REPLY_TO: env.EMAIL_REPLY_TO || "",
    VIDEO_PROVIDER: (env.VIDEO_PROVIDER as "mock") || "mock",
    DAILY_API_KEY: env.DAILY_API_KEY || "",
    DAILY_API_BASE_URL: env.DAILY_API_BASE_URL || "https://api.daily.co/v1",
    DAILY_DOMAIN: env.DAILY_DOMAIN || "",
    DAILY_FALLBACK_ENABLED: env.DAILY_FALLBACK_ENABLED === "true" ? "true" : "false",
  });

  if (!daily.dailyApiKey || !daily.dailyDomain) {
    return null;
  }

  return new DailyVideoProvider({
    apiKey: daily.dailyApiKey,
    apiBaseUrl: daily.dailyApiBaseUrl,
    domain: daily.dailyDomain,
    fallbackEnabled: daily.dailyFallbackEnabled,
  });
}
