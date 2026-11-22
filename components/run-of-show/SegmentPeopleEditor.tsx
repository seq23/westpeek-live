import { saveSegmentPeopleAction } from "@/lib/actions/runOfShowActions";
import type { ShowSegment } from "@/services/run-of-show/eventShow";

/**
 * Who is on in one segment: tick the speakers (those who have entered with the speaker code), name
 * the host or owner, anyone else on who has not entered yet, the cue notes for the crew, and whether
 * it is a networking block (guests then get the queue link on its row). Used
 * on Setup · Agenda and on the run of show; both save the same session.
 */
export function SegmentPeopleEditor({ eventId, segment, speakers }: { eventId: string; segment: ShowSegment; speakers: Array<{ guestId: string; name: string }> }) {
  if (!segment.sessionId) return null;
  return (
    <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-3" data-testid={`segment-people-editor-${segment.sessionId}`}>
      <summary className="cursor-pointer text-sm font-bold text-slate-900">
        Who is on{segment.speakers.length || segment.host || segment.alsoOn ? "" : " (nobody named yet)"}
        {segment.networking ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800" data-testid={`segment-networking-badge-${segment.sessionId}`}>Networking block</span> : null}
      </summary>
      <form action={saveSegmentPeopleAction} className="mt-3 grid gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="sessionId" value={segment.sessionId} />
        <fieldset className="grid gap-2">
          <legend className="text-xs font-bold text-slate-700">Speakers</legend>
          {speakers.length ? speakers.map((speaker) => (
            <label key={speaker.guestId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="speakerIds" value={speaker.guestId} defaultChecked={segment.speakerIds.includes(speaker.guestId)} data-testid={`segment-speaker-${segment.sessionId}-${speaker.guestId}`} />
              {speaker.name}
            </label>
          )) : <p className="text-xs text-slate-500">No speaker has entered with the speaker code yet. Name them under &ldquo;Also on&rdquo; for now.</p>}
        </fieldset>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Host or owner of this segment
          <input name="host" defaultValue={segment.host || ""} maxLength={120} placeholder="Priya (moderator)" className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal" data-testid={`segment-host-${segment.sessionId}`} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Also on (people not in the app yet)
          <input name="alsoOn" defaultValue={segment.alsoOn || ""} maxLength={240} placeholder="Jordan Ellis, Sam Okoro" className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Cue notes for the crew
          <textarea name="cueNotes" defaultValue={segment.cueNotes || ""} maxLength={1000} rows={2} placeholder="Roll the sponsor sting, then bring both panelists on" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal" data-testid={`segment-cues-${segment.sessionId}`} />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="networking" defaultChecked={segment.networking} className="mt-1" data-testid={`segment-networking-${segment.sessionId}`} />
          <span><span className="font-bold text-slate-900">Networking block</span><span className="block text-xs text-slate-600">Guests see a &ldquo;Join the networking queue&rdquo; link on this row of the agenda.</span></span>
        </label>
        <div><button className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white" data-testid={`segment-people-save-${segment.sessionId}`}>Save segment</button></div>
      </form>
    </details>
  );
}
