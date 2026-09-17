import { ComposeLink } from "@/components/email/ComposeLink";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { saveBackupRoomsAction } from "@/lib/actions/stageStreamActions";
import { rungReadiness } from "@/lib/video/fallbackReadiness";
import { findEventRecord } from "@/services/events/eventRepository";
import { getEventBackupRoom } from "@/services/video/backupRoomService";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";

/**
 * FALLBACK 3 AND FINAL — the two rungs a person can now set up.
 *
 * Until 17 Sep 2026 the Zoom rung read a meeting number out of a Worker variable and the Meet rung
 * read a URL out of another one, so in the one situation they exist for — the feed is down, the show
 * is running, the crew is walking down the ladder — there was no way to put a meeting in. The owner:
 * "so that if we degrade and must fall back to one of them a zoom meeting id can be put in".
 *
 * Three things on this card are not decoration:
 *
 *   · each rung's READINESS is the saved value, not prose. No meeting, no move, and the reason names
 *     the missing field;
 *   · what each rung CANNOT do is written where a producer reads it before choosing, because neither
 *     of these rungs can bring an attendee onto the West Peek stage and Meet takes them off the page
 *     entirely;
 *   · the Meet rung carries the offer to EMAIL everyone the new link, which is a link to the
 *     composer. Nothing sends from here. A person presses Send on the screen that shows who it is
 *     going to, exactly as every other send in this product does.
 */
function meetMessage(eventName: string, meetUrl: string) {
  return [
    `We have had to move the rest of ${eventName} to a Google Meet room.`,
    "",
    `Join here: ${meetUrl}`,
    "",
    "The chat, the attendee list and the networking on the West Peek page do not come with us, so use the Meet room's own chat. We are sorry for the interruption.",
  ].join("\n");
}

export async function BackupRoomsCard({ eventId, stageId = "main-stage", viewer: givenViewer, returnTo, saved, error }: { eventId: string; stageId?: string; viewer?: CrewViewer; returnTo?: string; saved?: boolean; error?: string }) {
  const [event, backup, state, viewer] = await Promise.all([
    findEventRecord(eventId).catch(() => undefined),
    getEventBackupRoom(eventId, stageId),
    getOperatorStageStreamState(eventId, stageId).catch(() => undefined),
    givenViewer ? Promise.resolve(givenViewer) : getCrewViewer(eventId),
  ]);
  const zoom = rungReadiness("ZOOM", process.env, backup);
  const meet = rungReadiness("GOOGLE_MEET", process.env, backup);
  const onMeet = state?.activeStreamSource === "GOOGLE_MEET";
  const eventName = event?.name || "this event";

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4" data-testid="backup-rooms-card" data-zoom-ready={zoom.ready ? "true" : "false"} data-meet-ready={meet.ready ? "true" : "false"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Backup rooms: Zoom and Google Meet</p>
        <span className="text-xs font-semibold text-slate-500" data-testid="backup-rooms-updated">
          {backup.updatedAt ? `Last saved by ${backup.updatedBy || "a crew member"}` : "Never set for this event"}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        The bottom two rungs of the ladder. Put a meeting in before the show and both rungs turn on; put one in during the show and it takes effect for everyone watching without anybody reloading anything.
      </p>

      {saved ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="backup-rooms-saved">Saved. The ladder now reads these.</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-900" data-testid="backup-rooms-error">{error}</p> : null}
      <DeniedNote viewer={viewer} action="go_live" className="mt-3" />

      <GatedForm viewer={viewer} action="go_live" formAction={saveBackupRoomsAction} className="mt-4 grid gap-4" testId="backup-rooms-form">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="stageId" value={stageId} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-950">Fallback 3 · Zoom, inside the venue</p>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${zoom.ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="backup-rooms-zoom-readiness">{zoom.ready ? "Ready" : "Not configured"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">Attendees stay on the West Peek page: our header, our chat, our attendee list, with the Zoom meeting embedded in the stage. They cannot be brought onto the West Peek stage from here — that is LiveKit only.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Meeting number
              <input name="zoomMeetingNumber" defaultValue={backup.zoomMeetingNumber || ""} placeholder="878 1234 5678" inputMode="numeric" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" data-testid="backup-rooms-zoom-number" />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Passcode, if it has one
              <input name="zoomPasscode" defaultValue={backup.zoomPasscode || ""} placeholder="Leave empty if there is none" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" data-testid="backup-rooms-zoom-passcode" />
            </label>
          </div>
          {zoom.ready ? null : <p className="mt-2 text-xs font-bold text-amber-800" data-testid="backup-rooms-zoom-unset">{zoom.reason}</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-950">Final · Google Meet, outside the venue</p>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${meet.ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="backup-rooms-meet-readiness">{meet.ready ? "Ready" : "Not configured"}</span>
          </div>
          {/* The one rung that leaves our page, so what stops working is spelled out before it is chosen. */}
          <p className="mt-1 text-xs font-bold text-slate-700" data-testid="backup-rooms-meet-warning">
            This is the only rung that takes attendees off the West Peek page. Chat, the attendee list, stage requests and speed networking do not travel with them, and nobody can be brought onto the West Peek stage from a Meet room. Everything they typed here stays here.
          </p>
          <label className="mt-3 grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            Meet link
            <input name="googleMeetUrl" defaultValue={backup.googleMeetUrl || ""} placeholder="https://meet.google.com/abc-defg-hij" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" data-testid="backup-rooms-meet-url" />
          </label>
          {meet.ready ? null : <p className="mt-2 text-xs font-bold text-amber-800" data-testid="backup-rooms-meet-unset">{meet.reason}</p>}
        </div>

        <div>
          <button className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="backup-rooms-save">Save backup rooms</button>
          <span className="ml-3 text-xs text-slate-500">Both are optional. Clearing a field turns that rung back off.</span>
        </div>
      </GatedForm>

      {/* Telling the people who are not looking at the page. A LINK to the composer, prefilled — the
          send still happens on the screen that shows exactly who it is going to, on a human press. */}
      <div className={`mt-4 rounded-2xl border p-4 ${onMeet ? "border-brand-orange bg-brand-orangeSoft" : "border-slate-200 bg-slate-50"}`} data-testid="backup-rooms-meet-email" data-active={onMeet ? "true" : "false"}>
        <p className="text-sm font-black text-slate-950">Tell the people who are not looking at the page</p>
        <p className="mt-1 text-xs text-slate-700">
          {meet.ready
            ? onMeet
              ? "The room has moved to Meet. Everyone with the page open sees the panel; everybody else needs an email."
              : "If you move down to Meet, the panel only reaches people who are still on the page. This opens the composer with the link and a short message already written, addressed to every registered attendee of this event. Nothing is sent until you read who it is going to and press Send there."
            : "Set the Meet link above first and this fills itself in."}
        </p>
        {meet.ready && backup.googleMeetUrl ? (
          <div className="mt-3">
            <ComposeLink
              eventId={eventId}
              audience="attendees"
              label="Email everyone the new link"
              subject={`We have moved ${eventName} to a Google Meet room`}
              body={meetMessage(eventName, backup.googleMeetUrl)}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
