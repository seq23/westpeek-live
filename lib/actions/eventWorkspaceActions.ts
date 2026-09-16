"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspaceActor, WorkspaceActorRequiredError } from "@/lib/auth/workspaceActor";
import { archiveEventRecord, createClientRecord, createEventRecord, isRuntimeSchemaMissing, restoreEventRecord, setEventStatus, updateEventRecord, type CreateEventInput } from "@/services/events/eventRepository";
import type { EventStatus } from "@/types/core";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failureRedirect(base: string, error: unknown): never {
  if (error instanceof WorkspaceActorRequiredError) redirect(`/production-access/owner?next=${encodeURIComponent(base)}`);
  if (isRuntimeSchemaMissing(error)) redirect(`${base}${base.includes("?") ? "&" : "?"}error=schema_missing`);
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message.slice(0, 160))}`);
}

/**
 * The single create action behind /app/events/new. NOW creates a live event and
 * lands the owner in its lobby with the join code; LATER creates a draft and
 * opens the event page where the guided spine hangs off.
 */
export async function createEventAction(formData: FormData): Promise<void> {
  const when = field(formData, "when") === "now" ? "now" : "later";
  let destination = "";
  try {
    const actor = await requireWorkspaceActor();
    const input: CreateEventInput = {
      name: field(formData, "name"),
      when,
      format: field(formData, "format") === "room" ? "room" : "stage",
      eventType: field(formData, "eventType") || undefined,
      clientId: field(formData, "clientId") || undefined,
      clientName: field(formData, "clientName") || undefined,
      startAt: field(formData, "startAt") || undefined,
      timezone: field(formData, "timezone") || undefined,
      description: field(formData, "description") || undefined,
    };
    const event = await createEventRecord(input, actor);
    revalidatePath("/app");
    revalidatePath("/app/events");
    destination = when === "now" ? `/venue/${event.id}/lobby?created=1` : `/app/events/${event.id}?created=1`;
  } catch (error) {
    failureRedirect("/app/events/new", error);
  }
  redirect(destination);
}

export async function publishEventAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const target = (field(formData, "status") || "registration_open") as EventStatus;
  const allowed: EventStatus[] = ["draft", "registration_open", "pre_event", "live", "ended", "replay_available"];
  const base = `/app/events/${eventId}/publish`;
  try {
    const actor = await requireWorkspaceActor();
    if (!allowed.includes(target)) throw new Error("Unsupported status transition.");
    await setEventStatus(eventId, target, actor);
    revalidatePath("/app/events");
    revalidatePath(`/app/events/${eventId}`);
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(target === "live" ? `/venue/${eventId}/lobby?created=1` : `${base}?updated=${target}`);
}

export async function archiveEventAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const returnTo = field(formData, "returnTo") || "/app/events";
  try {
    const actor = await requireWorkspaceActor();
    await archiveEventRecord(eventId, actor);
    revalidatePath("/app/events");
    revalidatePath(`/app/events/${eventId}`);
  } catch (error) {
    failureRedirect(returnTo, error);
  }
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}archived=${encodeURIComponent(eventId)}`);
}

export async function restoreEventAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const returnTo = field(formData, "returnTo") || "/app/events?showArchived=1";
  try {
    const actor = await requireWorkspaceActor();
    await restoreEventRecord(eventId, actor);
    revalidatePath("/app/events");
    revalidatePath(`/app/events/${eventId}`);
  } catch (error) {
    failureRedirect(returnTo, error);
  }
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}restored=${encodeURIComponent(eventId)}`);
}

export async function updateEventBasicsAction(formData: FormData): Promise<void> {
  const eventId = field(formData, "eventId");
  const base = `/app/events/${eventId}/setup`;
  try {
    const actor = await requireWorkspaceActor();
    const startAt = field(formData, "startAt");
    await updateEventRecord(eventId, {
      name: field(formData, "name") || undefined,
      eventType: field(formData, "eventType") || undefined,
      description: field(formData, "description") || undefined,
      timezone: field(formData, "timezone") || undefined,
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      registrationEnabled: field(formData, "registrationEnabled") === "on",
    }, actor);
    revalidatePath(`/app/events/${eventId}`);
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(`${base}?saved=1`);
}

export async function createClientAction(formData: FormData): Promise<void> {
  const returnTo = field(formData, "returnTo") || "/app/clients";
  let destination = returnTo;
  try {
    const actor = await requireWorkspaceActor();
    const client = await createClientRecord({
      name: field(formData, "name"),
      industry: field(formData, "industry") || undefined,
      primaryContactName: field(formData, "primaryContactName") || undefined,
      primaryContactEmail: field(formData, "primaryContactEmail") || undefined,
    }, actor);
    revalidatePath("/app/clients");
    destination = `${returnTo}${returnTo.includes("?") ? "&" : "?"}client=${encodeURIComponent(client.id)}`;
  } catch (error) {
    failureRedirect(returnTo, error);
  }
  redirect(destination);
}
