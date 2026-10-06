"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDbClient } from "@/lib/d1/binding";
import { approvalDecisionSchema, lastMinuteChangeDecisionSchema, productionInboxDecisionSchema } from "@/lib/validation/productionOpsSchemas";
import { decideApprovalRequest } from "@/services/approval-ops";
import { decideLastMinuteChange } from "@/services/change-control";
import { updateProductionInboxItem } from "@/services/event-intake";
import type { ActionState } from "./clientEventActions";

export async function decideApprovalAction(input: unknown): Promise<ActionState> {
  return runValidated(approvalDecisionSchema, input, async (parsed) => {
    const session = await requireUser();
    const result = await decideApprovalRequest(getDbClient(), parsed, session.id);
    if (result.error || !result.data) return { ok: false, message: result.error ?? "Could not update approval." };
    revalidatePath(`/app/events/${parsed.eventId}/approval-queue`);
    return { ok: true, message: "Approval updated.", id: result.data.id };
  });
}

export async function updateInboxItemAction(input: unknown): Promise<ActionState> {
  return runValidated(productionInboxDecisionSchema, input, async (parsed) => {
    const session = await requireUser();
    const result = await updateProductionInboxItem(getDbClient(), parsed, session.id);
    if (result.error || !result.data) return { ok: false, message: result.error ?? "Could not update inbox item." };
    revalidatePath(`/app/events/${parsed.eventId}/inbox`);
    return { ok: true, message: "Inbox item updated.", id: result.data.id };
  });
}

export async function decideLastMinuteChangeAction(input: unknown): Promise<ActionState> {
  return runValidated(lastMinuteChangeDecisionSchema, input, async (parsed) => {
    const session = await requireUser();
    const result = await decideLastMinuteChange(getDbClient(), parsed, session.id);
    if (result.error || !result.data) return { ok: false, message: result.error ?? "Could not update change request." };
    revalidatePath(`/app/events/${parsed.eventId}/change-control`);
    return { ok: true, message: "Change request updated.", id: result.data.id };
  });
}

async function runValidated<T>(schema: z.ZodSchema<T>, input: unknown, handler: (parsed: T) => Promise<ActionState>): Promise<ActionState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  return handler(parsed.data);
}
