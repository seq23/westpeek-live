import fs from "fs";
import path from "path";

export type SpeakerMaterialSubmissionKind = "teleprompter_note" | "deck" | "supporting_document" | "speaker_email_intake" | "crew_upload";

export interface SpeakerMaterialSubmission {
  id: string;
  eventId: string;
  speakerId: string;
  speakerName: string;
  kind: SpeakerMaterialSubmissionKind;
  title: string;
  notes: string;
  materialUrl?: string;
  submittedBy: "speaker_self_serve" | "crew_operator" | "email_manual_intake";
  status: "pending_producer_review" | "approved" | "changes_requested" | "archived";
  createdAt: string;
}

const RUNTIME_DIR = path.join(process.cwd(), ".runtime-data");
const QUEUE_PATH = path.join(RUNTIME_DIR, "speaker-material-submissions.json");

function readQueue(): SpeakerMaterialSubmission[] {
  try {
    if (!fs.existsSync(QUEUE_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: SpeakerMaterialSubmission[]) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2));
}

export function listSpeakerMaterialSubmissions(eventId: string): SpeakerMaterialSubmission[] {
  return readQueue()
    .filter((item) => item.eventId === eventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function submitSpeakerMaterial(input: {
  eventId: string;
  speakerId?: string;
  speakerName?: string;
  kind: SpeakerMaterialSubmissionKind;
  title: string;
  notes: string;
  materialUrl?: string;
  submittedBy: SpeakerMaterialSubmission["submittedBy"];
}) {
  const now = new Date().toISOString();
  const item: SpeakerMaterialSubmission = {
    id: `speaker-material-${input.eventId}-${Date.now()}`,
    eventId: input.eventId,
    speakerId: input.speakerId || "speaker-drake",
    speakerName: input.speakerName || "Speaker",
    kind: input.kind,
    title: input.title.trim() || "Speaker material update",
    notes: input.notes.trim(),
    materialUrl: input.materialUrl?.trim() || undefined,
    submittedBy: input.submittedBy,
    status: "pending_producer_review",
    createdAt: now,
  };
  const next = [item, ...readQueue()];
  writeQueue(next);
  return item;
}
