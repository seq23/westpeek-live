import { livekitPlanFit, type LiveKitPlanTooSmall, type LiveKitTier } from "@/lib/capacity/capacityPlans";
import { houseLivekitTier } from "@/services/agencies/houseDefaultsService";
import { listEventRecords } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * Does a scheduled event fit the LiveKit plan we are on? The run time is the event's own span
 * (start to end: the ingress publishes for the whole show); the expected audience is the people
 * registered for it, counted — a number nobody typed is not an expectation.
 */
export function eventRunMinutes(event: Pick<RuntimeEventRecord, "startAt" | "endAt">): number {
  const span = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
  return Number.isFinite(span) ? Math.max(0, Math.round(span / 60_000)) : 0;
}

export function eventLivekitPlanFit(event: Pick<RuntimeEventRecord, "startAt" | "endAt">, tier: LiveKitTier, expectedAudience: number): LiveKitPlanTooSmall | null {
  return livekitPlanFit({ tier, runMinutes: eventRunMinutes(event), expectedAudience });
}

const FINISHED = new Set(["ended", "replay_available", "archived"]);

export interface EventPlanWarning {
  event: RuntimeEventRecord;
  runMinutes: number;
  expectedAudience: number;
  warning: LiveKitPlanTooSmall;
}

/** Every event still to run that the current plan cannot carry. Read by /app/capacity and the launchpad. */
export async function scheduledEventsTooBigForPlan(now: Date = new Date()): Promise<{ tier: LiveKitTier; warnings: EventPlanWarning[] }> {
  const [tier, events, snapshot] = await Promise.all([
    houseLivekitTier(),
    listEventRecords({ includeSeed: false }).catch(() => [] as RuntimeEventRecord[]),
    getRuntimeStore().readSnapshot().catch(() => undefined),
  ]);
  const warnings: EventPlanWarning[] = [];
  for (const event of events) {
    if (FINISHED.has(event.status)) continue;
    if (new Date(event.endAt).getTime() < now.getTime()) continue;
    const expectedAudience = snapshot ? snapshot.registrations.filter((item) => item.eventId === event.id).length : 0;
    const warning = eventLivekitPlanFit(event, tier, expectedAudience);
    if (warning) warnings.push({ event, runMinutes: eventRunMinutes(event), expectedAudience, warning });
  }
  return { tier, warnings };
}
