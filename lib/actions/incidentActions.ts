"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { crewRoleLabels } from "@/lib/auth/crewRolePermissions";
import { logIncident, setIncidentStatus } from "@/services/incidents/incidentLog";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** A signed-in workspace person, or owner/operator/crew whose role may log incidents. Returns who, in words. */
async function requireIncidentAccess(eventId: string) {
  const actor = await getWorkspaceActor();
  if (actor) return actor.label;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "log_incident");
  if (!auth.ok) throw new Error(auth.error);
  return auth.crewRole ? crewRoleLabels[auth.crewRole] : auth.actorRole === "owner" ? "Owner" : "Operator";
}

function revalidateIncidentSurfaces(eventId: string) {
  for (const path of [`/app/events/${eventId}`, `/app/events/${eventId}/incidents`, `/app/events/${eventId}/report`, `/crew/events/${eventId}/run-of-show`]) revalidatePath(path);
}

export async function logIncidentAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  if (!eventId) return;
  const reportedBy = await requireIncidentAccess(eventId);
  await logIncident({ eventId, title: field(formData, "title"), details: field(formData, "details"), severity: field(formData, "severity"), status: field(formData, "status"), reportedBy });
  revalidateIncidentSurfaces(eventId);
}

export async function setIncidentStatusAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const id = field(formData, "incidentId");
  const status = field(formData, "status") === "resolved" ? "resolved" : "open";
  if (!eventId || !id) return;
  await requireIncidentAccess(eventId);
  await setIncidentStatus(eventId, id, status);
  revalidateIncidentSurfaces(eventId);
}
