"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceActor, type WorkspaceActor } from "@/lib/auth/workspaceActor";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import type { CrewAction } from "@/lib/auth/crewRolePermissions";
import { updateEventRecord } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { V6RunOfShowRuntimeEvent } from "@/services/runtime/runtimeStore";

/**
 * The producer's marks on the run of show. Each one is a row in v6_run_of_show_runtime_events, and
 * services/run-of-show/showProgress.ts reads those rows: "Mark live" makes that segment the one on
 * now on every surface, "Mark complete" closes it, "Skip" passes it. The buttons used to write rows
 * nothing read, next to "Delay", "Extend" and "Notify team" buttons that only wrote a "note".
 */
const MARKS: Record<string, V6RunOfShowRuntimeEvent["action"]> = {
  "Mark live": "mark_live",
  "Mark complete": "mark_complete",
  Skip: "skip",
};

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

/** A signed-in workspace person, or owner/operator/crew whose role may take the action. */
async function requireShowControl(eventId: string, action: CrewAction): Promise<WorkspaceActor> {
  const actor = await getWorkspaceActor();
  if (actor) return actor;
  const auth = await requireLiveEventControlAccessForRequest(eventId, action);
  if (!auth.ok) throw new Error(auth.error);
  const role = auth.crewRole || auth.actorRole;
  return { kind: "user", id: `crew:${role}`, label: role.replaceAll("_", " "), role };
}

async function revalidateShowSurfaces(eventId: string) {
  for (const path of [
    `/app/events/${eventId}`,
    `/app/events/${eventId}/run-of-show`,
    `/app/events/${eventId}/setup`,
    `/app/events/${eventId}/report`,
    `/crew/events/${eventId}`,
    `/crew/events/${eventId}/run-of-show`,
    `/venue/${eventId}/lobby`,
    `/venue/${eventId}/run-of-show`,
    `/speaker/events/${eventId}`,
  ]) revalidatePath(path);
}

export async function recordRunOfShowControlAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const segmentId = clean(formData.get("segmentId"));
  const action = MARKS[clean(formData.get("label"))];
  if (!eventId || !segmentId || !action) return;
  const actorRole = (await requireShowControl(eventId, "advance_run_of_show")).role;
  await getRuntimeStore().appendRunOfShowEvent({
    id: `ros-${eventId}-${segmentId}-${Date.now()}`,
    eventId,
    segmentId,
    action,
    actorRole,
    createdAt: new Date().toISOString(),
  });
  await revalidateShowSurfaces(eventId);
}

/**
 * Who is on in one segment: the speakers (ticked from those who entered with the speaker code),
 * the host or owner, anyone else on who is not in the app yet, and the cue notes for the crew.
 * Stored on the session inside the event row, so nothing else about the event changes.
 */
export async function saveSegmentPeopleAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const sessionId = clean(formData.get("sessionId"));
  if (!eventId || !sessionId) return;
  const actor = await requireShowControl(eventId, "manage_cue_cards");
  const event = await getRuntimeStore().getRuntimeEvent(eventId);
  if (!event) throw new Error("Only an event made in the app can name who is on; the demo keeps its own cast.");
  const speakerIds = Array.from(new Set(formData.getAll("speakerIds").map((value) => String(value).trim()).filter(Boolean))).slice(0, 12);
  const limit = (value: string, max: number) => value.slice(0, max);
  const sessions = event.sessions.length ? event.sessions : [{ id: `${event.id}-main-stage`, title: "Main stage", room: "Main Stage", startAt: event.startAt, endAt: event.endAt }];
  if (!sessions.some((session) => session.id === sessionId)) throw new Error("That segment is no longer on this event's timeline.");
  const next = sessions.map((session) => session.id === sessionId
    ? {
      ...session,
      speakerIds,
      host: limit(clean(formData.get("host")), 120) || undefined,
      alsoOn: limit(clean(formData.get("alsoOn")), 240) || undefined,
      cueNotes: limit(clean(formData.get("cueNotes")), 1000) || undefined,
    }
    : session);
  await updateEventRecord(event.id, { sessions: next }, actor);
  await revalidateShowSurfaces(eventId);
}
