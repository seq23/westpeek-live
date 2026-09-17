import { peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * "Is this the owner's own event, or the demo?" — asked once per workspace surface.
 *
 * Every page under app/app/events/[eventId] calls ensureRuntimeEvent() first, which puts a runtime
 * row in the request overlay; seed events never enter it. So a synchronous server component can ask
 * this without another store read. The `source !== "seed"` test is the one the rest of the app
 * already uses (the publish panel, the access page, the client portal, the crew briefing).
 *
 * The rule it enforces: a REAL event renders the runtime store or an honest empty state; a seed or
 * demo event keeps its compiled fixtures, because showing them is the whole point of a demo.
 */
export function realRuntimeEvent(eventId: string): RuntimeEventRecord | undefined {
  const event = peekOverlayEvent(eventId);
  return event && event.source !== "seed" ? event : undefined;
}

export function isRealRuntimeEvent(eventId: string) {
  return Boolean(realRuntimeEvent(eventId));
}
