import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { refusePreviewWrite } from "@/lib/auth/previewIdentity";
import type { AttendeeAgendaIntent } from "@/types/attendeeSession";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 50);
}

export async function upsertAttendeeAgendaIntent(input: Omit<AttendeeAgendaIntent, "id" | "updatedAt">) {
  refusePreviewWrite(input.attendeeId, "save an agenda");
  const intent: AttendeeAgendaIntent = {
    ...input,
    id: `agenda-intent-${input.eventId}-${input.attendeeId}`,
    plannedSessionIds: unique(input.plannedSessionIds),
    plannedBreakoutIds: unique(input.plannedBreakoutIds),
    plannedSponsorBoothIds: unique(input.plannedSponsorBoothIds),
    wantsSessionReminders: Boolean(input.wantsSessionReminders),
    updatedAt: new Date().toISOString(),
  };
  return getRuntimeStore().upsertAttendeeAgendaIntent(intent);
}

export async function getAttendeeAgendaIntent(eventId: string, attendeeId: string) {
  return getRuntimeStore().getAttendeeAgendaIntent(eventId, attendeeId);
}
