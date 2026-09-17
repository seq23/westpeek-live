"use client";
import { RegisterPointOfUse } from "@/components/venue/RegisterPointOfUse";
import { useAttendeeStageStatus, type AttendeeStageStatusSnapshot } from "@/components/video/useAttendeeStageStatus";
import type { AttendeeStageStatusKind } from "@/services/venue/attendeeStageStatus";

/**
 * The state line under the stage player, in plain words, with the one button that goes with it:
 *   "Want to speak? Request to join the stage" → "Requested — waiting for the crew" →
 *   "Approved — turn on your camera or mic below" → (on stage, from the control bar) →
 *   "Removed by the crew". When the crew has closed requests it says so; it never goes silent.
 * Polls the attendee's own status (~5s) so the line changes without a reload; the request itself
 * is the same server action as before (records `requested`, grants nothing).
 *
 * An unregistered viewer gets the same Request to Join Stage control, not a second register card:
 * the page's one register card is beside the chat, and pressing this control is what opens the ask
 * for the one thing raising a hand needs.
 */
const TEST_IDS: Record<AttendeeStageStatusKind, string> = {
  unregistered: "stage-join-registration-required",
  waiting_to_watch: "attendee-live-access-waiting",
  removed: "attendee-live-access-revoked",
  approved: "attendee-stage-approved",
  requested: "attendee-stage-request-pending",
  declined: "attendee-stage-request-declined",
  requests_closed: "attendee-stage-requests-closed",
  permitted: "attendee-live-access-permitted",
  can_request: "attendee-stage-can-request",
};

const TONES: Record<AttendeeStageStatusKind, string> = {
  unregistered: "border-slate-200 bg-slate-100 text-slate-800",
  waiting_to_watch: "border-amber-200 bg-amber-50 text-amber-900",
  removed: "border-rose-200 bg-rose-50 text-rose-900",
  approved: "border-emerald-300 bg-emerald-50 text-emerald-900",
  requested: "border-amber-200 bg-amber-50 text-amber-900",
  declined: "border-slate-200 bg-slate-100 text-slate-800",
  requests_closed: "border-slate-200 bg-slate-100 text-slate-800",
  permitted: "border-emerald-200 bg-emerald-50 text-emerald-900",
  can_request: "border-brand-orange/30 bg-brand-orangeSoft text-slate-950",
};

export function AttendeeStageJoinControls({ eventId, roomId, attendeeId, initial, requestAction }: { eventId: string; roomId: string; attendeeId?: string; initial: AttendeeStageStatusSnapshot; requestAction: (formData: FormData) => void | Promise<void> }) {
  const status = useAttendeeStageStatus(eventId, roomId, initial, Boolean(attendeeId)) || initial;
  const testId = TEST_IDS[status.status];
  return (
    <div className={`rounded-2xl border p-4 ${TONES[status.status]}`} data-testid={testId} data-stage-status={status.status}>
      <p className="text-base font-black" data-testid="attendee-stage-status-headline">{status.headline}</p>
      <p className="mt-1 text-sm">{status.detail}</p>
      {status.status === "approved" ? <p className="mt-1 text-xs">The crew can revoke or restore access at any time.</p> : null}
      {status.status === "unregistered" ? <div className="mt-3"><RegisterPointOfUse eventId={eventId} need="stage-request" label="Request to Join Stage" returnTo={`/venue/${eventId}/stage`} /></div> : null}
      {status.primary === "request" && attendeeId ? (
        <form action={requestAction} className="mt-3" data-testid="attendee-stage-request-form">
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value="main_stage" /><input type="hidden" name="roomId" value={roomId} /><input type="hidden" name="attendeeId" value={attendeeId} />
          <button className="min-h-12 w-full rounded-full bg-slate-950 px-6 py-3 text-base font-black text-white sm:w-auto" data-testid="attendee-stage-request-button">Request to Join Stage</button>
        </form>
      ) : null}
    </div>
  );
}
