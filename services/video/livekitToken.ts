import { createHmac, randomUUID } from "crypto";
import type { VideoRoomTokenRequest } from "@/types/video";

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface LiveKitTokenEnv {
  apiKey: string;
  apiSecret: string;
}

export function createLiveKitAccessToken(input: {
  env: LiveKitTokenEnv;
  request: VideoRoomTokenRequest;
  roomName: string;
}) {
  if (!input.env.apiKey || !input.env.apiSecret) {
    throw new Error("LiveKit API key and secret are required.");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + input.request.expiresInSeconds;
  // The identity is the room's primary key for a person: LiveKit disconnects whoever already holds
  // it. A slugified display name is not unique — two attendees called "Ada" displaced each other
  // and left a video-less ghost tile in a 1:1 (16 Sep 2026) — so it is never derived from the name.
  // Callers pass a stable per-person id (attendeeId, guestId); anything without one gets a fresh
  // random identity, which is unique and can therefore only ever displace itself.
  const identity = input.request.profileId?.trim() || `anon-${randomUUID()}`;

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    iss: input.env.apiKey,
    sub: identity,
    name: input.request.displayName,
    iat: now,
    nbf: now,
    exp: expiresAt,
    jti: randomUUID(),
    video: {
      room: input.roomName,
      roomJoin: true,
      canPublish: input.request.canPublishAudio || input.request.canPublishVideo || input.request.canShareScreen,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    },
    metadata: JSON.stringify({
      role: input.request.role,
      eventId: input.request.eventId,
      profileId: input.request.profileId,
    }),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", input.env.apiSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return {
    token: `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`,
    participantIdentity: identity,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}
