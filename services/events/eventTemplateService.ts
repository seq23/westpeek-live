import { randomId } from "@/lib/security/portableCrypto";
import { getHouseDefaults, markStarterTemplatesInstalled } from "@/services/agencies/houseDefaultsService";
import { STARTER_EVENT_TEMPLATES } from "./starterEventTemplates";
import { findEventRecord } from "@/services/events/eventRepository";
import { questionsForEvent } from "@/services/attendees/registrationQuestions";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { EventTemplateRecord, TemplateSession } from "@/types/eventTemplates";

/**
 * Templates are a starting point for an event, saved from an event that already worked. They live
 * in the runtime store (migration 0033) rather than compiled JSON, and every field is one the
 * create form actually reads — a template that carried things nothing consumes would be decoration,
 * which is what the old seed cards were.
 *
 * A clean install now arrives with four of them (see starterEventTemplates.ts) so the shelf is
 * never empty. They are written once and are then ordinary rows: editable, deletable, gone for good
 * when deleted.
 */
function now() {
  return new Date().toISOString();
}

/**
 * Write the four starter templates, once, on a store that has never had them.
 *
 * The shelf was empty on a clean install, so the create form offered nothing and the feature looked
 * missing. These are written as ORDINARY ROWS — the owner can edit or delete any of them — and the
 * install is stamped on the house defaults row so a deleted one stays deleted. It is not a seed
 * fixture and it is not on any seed-data exemption list; after this runs there is nothing to
 * distinguish a starter from a template saved off a real event.
 */
export async function installStarterTemplatesOnce() {
  const house = await getHouseDefaults();
  if (house.starterTemplatesInstalledAt) return { installed: 0 };
  const at = now();
  const store = getRuntimeStore();
  for (const starter of STARTER_EVENT_TEMPLATES) {
    await store.upsertEventTemplate({ ...starter, createdAt: at, updatedAt: at });
  }
  await markStarterTemplatesInstalled(at);
  return { installed: STARTER_EVENT_TEMPLATES.length };
}

export async function listEventTemplates() {
  await installStarterTemplatesOnce().catch(() => undefined);
  return getRuntimeStore().listEventTemplates().catch(() => [] as EventTemplateRecord[]);
}

export async function getEventTemplate(id: string) {
  return getRuntimeStore().getEventTemplate(id).catch(() => undefined);
}

export interface SaveTemplateInput {
  name: string;
  description?: string;
  format?: "stage" | "room";
  eventType?: string;
  durationMinutes?: number;
  sessions?: TemplateSession[];
  registrationQuestions?: string[];
  createdByLabel: string;
}

export async function saveEventTemplate(input: SaveTemplateInput) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, reason: "A template needs a name — something you will recognise in a month." };
  const template: EventTemplateRecord = {
    id: randomId("template"),
    name,
    description: input.description?.trim() || "",
    format: input.format === "room" ? "room" : "stage",
    eventType: input.eventType?.trim() || "webinar",
    durationMinutes: Math.max(15, Math.min(480, Number(input.durationMinutes) || 60)),
    // A five-minute floor: a session shorter than that is a typo, and the agenda maths needs a real number.
    sessions: (input.sessions || []).slice(0, 20).map((session) => ({ title: session.title.trim() || "Session", minutes: Math.max(5, Math.min(480, Number(session.minutes) || 30)) })),
    registrationQuestions: (input.registrationQuestions || []).slice(0, 8),
    createdByLabel: input.createdByLabel,
    createdAt: now(),
    updatedAt: now(),
  };
  await getRuntimeStore().upsertEventTemplate(template);
  return { ok: true as const, template };
}

/** "Save this event as a template": everything the create form would need to make one like it. */
export async function templateFromEvent(eventId: string, name: string, createdByLabel: string) {
  const event = await findEventRecord(eventId);
  if (!event) return { ok: false as const, reason: "That event is not in the store." };
  const minutes = Math.max(15, Math.round((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000) || 60);
  return saveEventTemplate({
    name: name.trim() || `${event.name} template`,
    description: `Saved from ${event.name}.`,
    format: event.format === "room" ? "room" : "stage",
    eventType: event.eventType,
    durationMinutes: minutes,
    sessions: (event.sessions || []).map((session) => ({ title: session.title, minutes: Math.max(5, Math.round((new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60000) || 30) })),
    registrationQuestions: questionsForEvent(event).map((question) => `${question.label}${question.type === "tags" ? " | tags" : ""}`),
    createdByLabel,
  });
}

export async function deleteEventTemplate(id: string) {
  await getRuntimeStore().deleteEventTemplate(id).catch(() => undefined);
}
