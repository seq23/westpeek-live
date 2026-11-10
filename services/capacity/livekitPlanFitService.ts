import { RECORDED_SERVICE_PLANS, eventPlanShortfalls, livekitPlanFit, type LiveKitPlanTooSmall, type LiveKitTier, type PlanShortfall, type RecordedPlans } from "@/lib/capacity/capacityPlans";
import { houseLivekitTier } from "@/services/agencies/houseDefaultsService";
import { listEventRecords } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * Does a scheduled event fit the plans we are on? The run time is the event's own span (start to
 * end: the ingress publishes for the whole show); the audience is the people registered for it,
 * counted — a number nobody typed is not an expectation.
 */
export function eventRunMinutes(event: Pick<RuntimeEventRecord, "startAt" | "endAt">): number {
  const span = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
  return Number.isFinite(span) ? Math.max(0, Math.round(span / 60_000)) : 0;
}

export function eventLivekitPlanFit(event: Pick<RuntimeEventRecord, "startAt" | "endAt">, tier: LiveKitTier, expectedAudience: number): LiveKitPlanTooSmall | null {
  return livekitPlanFit({ tier, runMinutes: eventRunMinutes(event), expectedAudience });
}

export function eventShortfalls(event: Pick<RuntimeEventRecord, "startAt" | "endAt" | "format">, plans: RecordedPlans, audience: number): PlanShortfall[] {
  return eventPlanShortfalls({ runMinutes: eventRunMinutes(event), audience, format: event.format }, plans);
}

/** The plans in force: LiveKit from Settings (or LIVEKIT_TIER), the rest as recorded in capacityPlans.ts. */
export async function currentPlans(): Promise<RecordedPlans> {
  return { livekit: await houseLivekitTier(), ...RECORDED_SERVICE_PLANS };
}

/** People registered for one event (active attendee profiles: one per person, re-registering does not double-count). */
export async function registeredAudience(eventId: string): Promise<number> {
  const profiles = await getRuntimeStore().listAttendeeProfiles(eventId, 100_000).catch(() => []);
  return profiles.length;
}

const FINISHED = new Set(["ended", "replay_available", "archived"]);

export function isStillToRun(event: Pick<RuntimeEventRecord, "status" | "endAt">, now: Date) {
  return !FINISHED.has(event.status) && new Date(event.endAt).getTime() >= now.getTime();
}

export interface EventPlanWarning {
  event: RuntimeEventRecord;
  runMinutes: number;
  expectedAudience: number;
  shortfalls: PlanShortfall[];
}

/** Every event still to run that the current plans cannot carry. Read by the red banner, /app/capacity and the health route. */
export async function scheduledEventsTooBigForPlan(now: Date = new Date()): Promise<{ plans: RecordedPlans; warnings: EventPlanWarning[] }> {
  const [plans, events] = await Promise.all([
    currentPlans(),
    listEventRecords({ includeSeed: false }).catch(() => [] as RuntimeEventRecord[]),
  ]);
  const upcoming = events.filter((event) => isStillToRun(event, now));
  const audiences = await Promise.all(upcoming.map((event) => registeredAudience(event.id)));
  const warnings: EventPlanWarning[] = [];
  upcoming.forEach((event, index) => {
    const shortfalls = eventShortfalls(event, plans, audiences[index]);
    if (shortfalls.length) warnings.push({ event, runMinutes: eventRunMinutes(event), expectedAudience: audiences[index], shortfalls });
  });
  return { plans, warnings };
}

/** The one structured server line. Kept apart so a test can read it without a store. */
export function planNoticeLine(event: Pick<RuntimeEventRecord, "id" | "startAt">, shortfalls: PlanShortfall[]) {
  return `NOTICE [PLAN_TOO_SMALL] event=${event.id} services=${shortfalls.map((item) => item.service).join(",")} starts=${new Date(event.startAt).toISOString()}`;
}

/**
 * Called whenever an event is created, scheduled, re-timed or gains registrations. When it does not
 * fit, logs one NOTICE line and returns the shortfalls; otherwise returns []. Never throws: a plan
 * check must not stop an event being saved.
 * `previousAudience`: log only when this change made a service fall short that did not before (a
 * registration), so 200 sign-ups do not write 200 lines.
 */
export async function noticeEventPlanFit(event: RuntimeEventRecord, options: { previousAudience?: number; now?: Date } = {}): Promise<PlanShortfall[]> {
  try {
    if (!isStillToRun(event, options.now || new Date())) return [];
    const [plans, audience] = await Promise.all([currentPlans(), registeredAudience(event.id)]);
    const shortfalls = eventShortfalls(event, plans, audience);
    if (!shortfalls.length) return [];
    if (options.previousAudience !== undefined) {
      const before = new Set(eventShortfalls(event, plans, options.previousAudience).map((item) => item.service));
      if (shortfalls.every((item) => before.has(item.service))) return shortfalls;
    }
    console.warn(planNoticeLine(event, shortfalls));
    return shortfalls;
  } catch {
    return [];
  }
}

/** For the public health route: counts and service names only, never an event's name or id. */
export async function planFitHealth(now: Date = new Date()) {
  const { warnings } = await scheduledEventsTooBigForPlan(now);
  const services = Array.from(new Set(warnings.flatMap((item) => item.shortfalls.map((shortfall) => shortfall.service))));
  return {
    ok: warnings.length === 0,
    eventsNeedingUpgrade: warnings.length,
    services,
    notice: warnings.length ? `NOTICE [PLAN_TOO_SMALL] ${warnings.length} event(s) still to run will not fit: upgrade ${services.join(", ")}` : "",
  };
}
