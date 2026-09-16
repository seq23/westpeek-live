"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceActor } from "@/lib/auth/workspaceActor";
import { deleteEventTemplate, saveEventTemplate, templateFromEvent } from "@/services/events/eventTemplateService";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function parseSessions(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const [title, minutes] = line.split("|").map((part) => part.trim());
      return { title: title || "Session", minutes: Math.max(5, Number(minutes) || 30) };
    });
}

/** Save a template by hand: the same fields the create form reads, nothing decorative. */
export async function saveTemplateAction(formData: FormData) {
  const actor = await requireWorkspaceActor();
  const result = await saveEventTemplate({
    name: clean(formData.get("name")),
    description: clean(formData.get("description")),
    format: clean(formData.get("format")) === "room" ? "room" : "stage",
    eventType: clean(formData.get("eventType")) || "webinar",
    durationMinutes: Number(clean(formData.get("durationMinutes"))) || 60,
    sessions: parseSessions(clean(formData.get("sessions"))),
    registrationQuestions: clean(formData.get("registrationQuestions")).split("\n").map((line) => line.trim()).filter(Boolean),
    createdByLabel: actor.label,
  });
  revalidatePath("/app/templates");
  if (!result.ok) redirect(`/app/templates?templateError=${encodeURIComponent(result.reason)}`);
  redirect(`/app/templates?saved=${encodeURIComponent(result.template.name)}`);
}

/** "Save this event as a template" — from the event itself, so it carries what that event really is. */
export async function saveEventAsTemplateAction(formData: FormData) {
  const actor = await requireWorkspaceActor();
  const eventId = clean(formData.get("eventId"));
  if (!eventId) return;
  const result = await templateFromEvent(eventId, clean(formData.get("name")), actor.label);
  revalidatePath("/app/templates");
  revalidatePath(`/app/events/${eventId}`);
  if (!result.ok) redirect(`/app/events/${eventId}?error=${encodeURIComponent(result.reason)}`);
  redirect(`/app/templates?saved=${encodeURIComponent(result.template.name)}`);
}

export async function deleteTemplateAction(formData: FormData) {
  await requireWorkspaceActor();
  const id = clean(formData.get("templateId"));
  if (!id) return;
  await deleteEventTemplate(id);
  revalidatePath("/app/templates");
  redirect("/app/templates?deleted=1");
}
