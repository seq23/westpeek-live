"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDbClient } from "@/lib/d1/binding";
import { clientInputSchema, eventInputSchema } from "@/lib/validation/clientEventSchemas";
import { createClientRecord, updateClientRecord } from "@/services/clients";
import { createEventRecord, updateEventRecord } from "@/services/events";

export interface ActionState {
  ok: boolean;
  message: string;
  id?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createClientAction(input: unknown): Promise<ActionState> {
  return runValidated(clientInputSchema, input, async (parsed) => {
    const session = await requireUser();
    const db = getDbClient();
    const result = await createClientRecord(db, parsed, session.id);
    if (result.error || !result.data) return { ok: false, message: result.error ?? "Could not create client." };
    revalidatePath("/app/clients");
    return { ok: true, message: "Client created.", id: result.data.id };
  });
}

export async function updateClientAction(clientId: string, input: unknown): Promise<ActionState> {
  return runValidated(clientInputSchema, input, async (parsed) => {
    const session = await requireUser();
    const db = getDbClient();
    const result = await updateClientRecord(db, clientId, parsed, session.id);
    if (result.error || !result.data) return { ok: false, message: result.error ?? "Could not update client." };
    revalidatePath(`/app/clients/${clientId}`);
    return { ok: true, message: "Client updated.", id: result.data.id };
  });
}

export async function createEventAction(input: unknown): Promise<ActionState> {
  return runValidated(eventInputSchema, input, async (parsed) => {
    const session = await requireUser();
    const db = getDbClient();
    const result = await createEventRecord(db, parsed, session.id);
    if (result.error || !result.data) return { ok: false, message: result.error ?? "Could not create event." };
    revalidatePath("/app/events");
    return { ok: true, message: "Event created.", id: result.data.id };
  });
}

export async function updateEventAction(eventId: string, input: unknown): Promise<ActionState> {
  return runValidated(eventInputSchema, input, async (parsed) => {
    const session = await requireUser();
    const db = getDbClient();
    const result = await updateEventRecord(db, eventId, parsed, session.id);
    if (result.error || !result.data) return { ok: false, message: result.error ?? "Could not update event." };
    revalidatePath(`/app/events/${eventId}/overview`);
    return { ok: true, message: "Event updated.", id: result.data.id };
  });
}


function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createClientFromFormAction(formData: FormData): Promise<ActionState> {
  return createClientAction(formDataToObject(formData));
}

export async function createClientFromFormSubmitAction(formData: FormData): Promise<void> {
  await createClientFromFormAction(formData);
}

export async function createEventFromFormAction(formData: FormData): Promise<ActionState> {
  return createEventAction(formDataToObject(formData));
}

export async function createEventFromFormSubmitAction(formData: FormData): Promise<void> {
  await createEventFromFormAction(formData);
}

async function runValidated<T>(schema: z.ZodSchema<T>, input: unknown, handler: (parsed: T) => Promise<ActionState>): Promise<ActionState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  return handler(parsed.data);
}
