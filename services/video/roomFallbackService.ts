import { randomId } from "@/lib/security/portableCrypto";
import { recordAutomaticIncident } from "@/services/incidents/incidentLog";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { V4RoomFallbackState, V4RoomType, V4VideoProvider } from "@/types/v4";

const providerLadder: V4VideoProvider[] = ["livekit", "cloudflare_stream", "daily", "zoom", "google_meet"];
const manualOnlyProviders: V4VideoProvider[] = ["zoom", "google_meet"];

function fallbackKey(eventId: string, roomType: V4RoomType) {
  return `${eventId}:${roomType}`;
}

export function createInitialRoomFallbackState(eventId: string, roomType: V4RoomType): V4RoomFallbackState {
  return {
    eventId,
    roomId: `${eventId}-${roomType}`,
    roomType,
    activeProvider: "livekit",
    health: { livekit: "healthy", cloudflare_stream: "healthy", daily: "healthy", zoom: "unknown", google_meet: "unknown" },
    automaticFallbackEnabled: true,
    rollbackAvailable: false,
    lastCheckedAt: new Date().toISOString(),
    auditEventIds: [],
  };
}

export async function getRoomFallbackState(eventId: string, roomType: V4RoomType = "main_stage"): Promise<V4RoomFallbackState> {
  const key = fallbackKey(eventId, roomType);
  const store = getRuntimeStore();
  const existing = await store.getFallbackState(key);
  if (existing) return existing;
  return store.setFallbackState(key, createInitialRoomFallbackState(eventId, roomType));
}

export function recommendFallbackProvider(state: V4RoomFallbackState): V4VideoProvider {
  if (state.manualOverrideProvider) return state.manualOverrideProvider;
  for (const provider of providerLadder) if (state.health[provider] === "healthy") return provider;
  return "google_meet";
}

export function canAutoSwitchTo(provider: V4VideoProvider) {
  return provider === "cloudflare_stream" || provider === "daily";
}

export function requiresCrewConfirmation(provider: V4VideoProvider) {
  return manualOnlyProviders.includes(provider);
}

async function appendFallbackAudit(state: V4RoomFallbackState, provider: V4VideoProvider, action: "auto_switch" | "manual_switch" | "rollback" | "health_check", actorRole?: string, reason?: string) {
  const event = await getRuntimeStore().appendFallbackEvent({
    id: randomId("fallback"),
    eventId: state.eventId,
    roomId: state.roomId,
    roomType: state.roomType,
    provider,
    action,
    actorRole,
    reason,
    createdAt: new Date().toISOString(),
  });
  return event.id;
}

export async function switchRoomFallback(input: { state: V4RoomFallbackState; provider: V4VideoProvider; confirmedByCrew: boolean; actorRole?: string; reason?: string; }) {
  if (requiresCrewConfirmation(input.provider) && !input.confirmedByCrew) throw new Error("Zoom and Google Meet fallback require explicit crew confirmation.");
  const action = canAutoSwitchTo(input.provider) ? "auto_switch" : "manual_switch";
  const auditId = await appendFallbackAudit(input.state, input.provider, action, input.actorRole || "technical_director", input.reason);
  const next = {
    ...input.state,
    activeProvider: input.provider,
    manualOverrideProvider: canAutoSwitchTo(input.provider) ? undefined : input.provider,
    rollbackAvailable: true,
    lastCheckedAt: new Date().toISOString(),
    auditEventIds: [...input.state.auditEventIds, auditId],
  } satisfies V4RoomFallbackState;
  const saved = await getRuntimeStore().setFallbackState(fallbackKey(next.eventId, next.roomType), next);
  if (input.provider !== "livekit" && input.provider !== input.state.activeProvider) {
    await recordAutomaticIncident({ eventId: next.eventId, title: `${next.roomType.replaceAll("_", " ")} moved to a backup path: ${PROVIDER_NAMES[input.provider]}`, details: `Switched from ${PROVIDER_NAMES[input.state.activeProvider]} by ${input.actorRole || "technical director"}.${input.reason ? ` ${input.reason}` : ""}`, severity: "high" });
  }
  return saved;
}

const PROVIDER_NAMES: Record<V4VideoProvider, string> = { livekit: "the main stream", cloudflare_stream: "Cloudflare Stream", daily: "Daily", zoom: "Zoom", google_meet: "Google Meet" };

export async function clearRoomFallbackOverride(state: V4RoomFallbackState, actorRole = "technical_director") {
  const auditId = await appendFallbackAudit(state, "livekit", "rollback", actorRole, "clear_manual_override");
  const next = {
    ...state,
    activeProvider: "livekit",
    manualOverrideProvider: undefined,
    rollbackAvailable: false,
    lastCheckedAt: new Date().toISOString(),
    auditEventIds: [...state.auditEventIds, auditId],
  } satisfies V4RoomFallbackState;
  return getRuntimeStore().setFallbackState(fallbackKey(next.eventId, next.roomType), next);
}

export async function runRoomHealthCheck(eventId: string, roomType: V4RoomType = "main_stage", actorRole = "technical_director") {
  const state = await getRoomFallbackState(eventId, roomType);
  const auditId = await appendFallbackAudit(state, state.activeProvider, "health_check", actorRole, "operator_health_check");
  const next = {
    ...state,
    lastCheckedAt: new Date().toISOString(),
    auditEventIds: [...state.auditEventIds, auditId],
  } satisfies V4RoomFallbackState;
  return getRuntimeStore().setFallbackState(fallbackKey(next.eventId, next.roomType), next);
}
