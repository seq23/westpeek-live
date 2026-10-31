import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { V6IncidentRuntimeEvent } from "@/services/runtime/runtimeStore";

/**
 * One event's incident log, stored in D1 (v6_incident_events; migration 0007 added who logged it,
 * whether a person or the app did, and when it was resolved). The page used to print two fixed
 * sample incidents on every event — one of them "Daily fallback verified" on events where Daily
 * was switched off.
 *
 * People log incidents from the incident page. The app logs one itself when the main stage moves
 * to a backup path or a video health check fails (services/video/*), so the log shows what really
 * happened without anyone having to remember to write it down.
 */
export type IncidentSeverity = V6IncidentRuntimeEvent["severity"];
export type IncidentStatus = "open" | "resolved";
export type Incident = V6IncidentRuntimeEvent;

export const INCIDENT_SEVERITIES: Array<{ value: IncidentSeverity; label: string }> = [
  { value: "low", label: "Low: noticed, no one was affected" },
  { value: "medium", label: "Medium: some people were affected" },
  { value: "high", label: "High: the show was affected" },
  { value: "critical", label: "Critical: the show stopped" },
];

const SEVERITIES = new Set<IncidentSeverity>(INCIDENT_SEVERITIES.map((item) => item.value));

export interface IncidentInput {
  eventId: string;
  title: string;
  details?: string;
  severity: string;
  status?: string;
  reportedBy: string;
}

/** The rules for a person's entry, kept apart from the store so they can be tested on their own. */
export function validateIncidentInput(input: IncidentInput): { ok: true; value: Omit<Incident, "id" | "createdAt"> } | { ok: false; error: string } {
  const title = input.title.trim().slice(0, 160);
  if (!input.eventId.trim()) return { ok: false, error: "Which event is this for?" };
  if (!title) return { ok: false, error: "Say what happened in a few words." };
  const severity = input.severity as IncidentSeverity;
  if (!SEVERITIES.has(severity)) return { ok: false, error: "Pick how serious it was." };
  const status: IncidentStatus = input.status === "resolved" ? "resolved" : "open";
  return {
    ok: true,
    value: {
      eventId: input.eventId.trim(),
      title,
      details: (input.details || "").trim().slice(0, 2000),
      severity,
      status,
      ownerRole: input.reportedBy || "crew",
      source: "manual",
      reportedBy: input.reportedBy || undefined,
    },
  };
}

function newId() {
  return `incident-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listEventIncidents(eventId: string): Promise<Incident[]> {
  return getRuntimeStore().listIncidents(eventId).catch(() => []);
}

export async function logIncident(input: IncidentInput, now = new Date()): Promise<Incident> {
  const checked = validateIncidentInput(input);
  if (!checked.ok) throw new Error(checked.error);
  const createdAt = now.toISOString();
  const incident: Incident = { ...checked.value, id: newId(), createdAt, updatedAt: createdAt, resolvedAt: checked.value.status === "resolved" ? createdAt : undefined };
  await getRuntimeStore().appendIncident(incident);
  return incident;
}

export async function setIncidentStatus(eventId: string, id: string, status: IncidentStatus, now = new Date()) {
  return getRuntimeStore().updateIncidentStatus({ id, eventId, status, updatedAt: now.toISOString() });
}

/** How long an open automatic incident with the same title absorbs repeats (a flapping stream logs once). */
export const AUTOMATIC_REPEAT_WINDOW_MS = 15 * 60_000;

/**
 * The app's own entry. Never throws: a failed log line must not break the stream switch that
 * caused it. A repeat of an open automatic incident within the window is not logged twice.
 */
export async function recordAutomaticIncident(input: { eventId: string; title: string; details: string; severity: IncidentSeverity }, now = new Date()): Promise<Incident | undefined> {
  try {
    const store = getRuntimeStore();
    const existing = await store.listIncidents(input.eventId);
    const repeat = existing.find((item) => item.source === "automatic" && item.status !== "resolved" && item.title === input.title && now.getTime() - new Date(item.createdAt).getTime() < AUTOMATIC_REPEAT_WINDOW_MS);
    if (repeat) return undefined;
    const createdAt = now.toISOString();
    const incident: Incident = { id: newId(), eventId: input.eventId, title: input.title.slice(0, 160), details: input.details.slice(0, 2000), severity: input.severity, status: "open", ownerRole: "system", source: "automatic", reportedBy: "Logged by the app", createdAt, updatedAt: createdAt };
    await store.appendIncident(incident);
    return incident;
  } catch (error) {
    console.warn(`[incidents] automatic incident not logged for ${input.eventId}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
