"use server";

import { revalidatePath } from "next/cache";
import { submitSpeakerMaterial, type SpeakerMaterialSubmissionKind } from "@/services/speakers/speakerMaterialQueue";
import { requireOperatorAccessForRequest } from "@/lib/auth/operatorRequestGuard";

function normalizeKind(value: FormDataEntryValue | null): SpeakerMaterialSubmissionKind {
  const raw = String(value || "teleprompter_note");
  if (["teleprompter_note", "deck", "supporting_document", "speaker_email_intake", "crew_upload"].includes(raw)) return raw as SpeakerMaterialSubmissionKind;
  return "teleprompter_note";
}

export async function intakeSpeakerMaterialAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") || "").trim();
  const speakerId = String(formData.get("speakerId") || "speaker-drake").trim();
  const speakerName = String(formData.get("speakerName") || "Speaker").trim();
  const kind = normalizeKind(formData.get("kind"));
  const title = String(formData.get("title") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const materialUrl = String(formData.get("materialUrl") || "").trim();
  const source = String(formData.get("source") || "crew_operator");
  const submittedBy = source === "email_manual_intake" ? "email_manual_intake" : "crew_operator";

  if (!eventId) return;
  const operatorAccess = await requireOperatorAccessForRequest();
  if (!operatorAccess.ok) return;
  if (!title && !notes && !materialUrl) return;

  submitSpeakerMaterial({ eventId, speakerId, speakerName, kind, title, notes, materialUrl, submittedBy });
  revalidatePath(`/app/events/${eventId}/approval-queue`);
  revalidatePath(`/speaker/events/${eventId}/teleprompter`);
}
