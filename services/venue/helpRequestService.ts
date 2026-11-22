import { refusePreviewWrite } from "@/lib/auth/previewIdentity";

export function buildHelpRequestDraft(input: {
  agencyId: string;
  eventId: string;
  attendeeId?: string;
  topic: string;
  subject: string;
  message: string;
}) {
  refusePreviewWrite(input.attendeeId, "raise a help request");
  return {
    ...input,
    status: "open" as const,
    createdAt: new Date().toISOString(),
  };
}
