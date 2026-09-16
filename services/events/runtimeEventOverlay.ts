import { findEventRecord } from "@/services/events/eventRepository";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * Request-time bridge between the async event repository and the synchronous
 * config/read-model helpers that dozens of server components still call
 * (`getEventConfig`, `getEvent`, `getSessionsForEvent`, ...).
 *
 * A page that can render a runtime-created event calls `ensureRuntimeEvent(id)`
 * once at the top; that always refetches from the store, so the overlay entry
 * for that event is fresh for the rest of the render. Seed events never enter
 * the overlay — they stay in compiled JSON.
 */
const overlay = new Map<string, RuntimeEventRecord>();

function keysFor(event: RuntimeEventRecord) {
  return [event.id, event.slug, event.joinCode].map((key) => key.trim().toLowerCase()).filter(Boolean);
}

export function registerOverlayEvent(event: RuntimeEventRecord) {
  if (event.source === "seed") return event;
  for (const key of keysFor(event)) overlay.set(key, event);
  return event;
}

export function forgetOverlayEvent(event: RuntimeEventRecord) {
  for (const key of keysFor(event)) overlay.delete(key);
}

export function peekOverlayEvent(codeOrSlugOrId: string | undefined): RuntimeEventRecord | undefined {
  const key = codeOrSlugOrId?.trim().toLowerCase();
  if (!key) return undefined;
  return overlay.get(key);
}

export function listOverlayEvents(): RuntimeEventRecord[] {
  return Array.from(new Map(Array.from(overlay.values()).map((event) => [event.id, event])).values());
}

export async function ensureRuntimeEvent(codeOrSlugOrId: string | undefined): Promise<RuntimeEventRecord | undefined> {
  const record = await findEventRecord(codeOrSlugOrId);
  if (!record) {
    const stale = peekOverlayEvent(codeOrSlugOrId);
    if (stale) forgetOverlayEvent(stale);
    return undefined;
  }
  return registerOverlayEvent(record);
}

export async function ensureRuntimeEvents(events: RuntimeEventRecord[]) {
  for (const event of events) registerOverlayEvent(event);
  return events;
}

export function resetOverlayForTests() {
  overlay.clear();
}
