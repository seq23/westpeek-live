import { setAttendeeLiveApproval } from "@/lib/actions/attendeeLiveActions";
import { AttendeeLiveRoster } from "@/components/moderation/AttendeeLiveRoster";
import { LiveRoomControlForms } from "@/components/moderation/LiveRoomControlForms";
import { SafeSection } from "@/components/system/SafeSection";

/**
 * Testing-console view of the crew live controls: the room-wide switches, the roster with
 * one-click permit / approve / revoke / silence and the pending-request queue, and — folded
 * away — the original by-id form for the rare attendee who is not on the roster.
 */
export async function AttendeeLiveControlPanel({ eventId = "event-summit", search = "", searchAction }: { eventId?: string; search?: string; searchAction?: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="attendee-live-control-panel">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Attendee live controls</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">Crew-controlled camera and mic permissions</h2>
      <p className="mt-2 text-sm text-slate-600">Main stage attendee publishing is off/request-based by default. Breakout rooms can allow attendee camera/mic, but crew can revoke or emergency-disable all publishing.</p>
      <div className="mt-4"><SafeSection label="Room-wide live controls" render={() => LiveRoomControlForms({ eventId: eventId })} /></div>
      <div className="mt-4"><SafeSection label="Attendee roster" render={() => AttendeeLiveRoster({ eventId, search, searchAction: searchAction || `/admin/testing/${eventId}` })} /></div>
      <details className="mt-4 rounded-2xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-black">By attendee id (fallback when someone is not on the roster)</summary>
        <form action={setAttendeeLiveApproval} className="mt-3">
          <p className="font-black">Attendee permit / revoke / re-permit path</p>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value="main_stage" /><input type="hidden" name="roomId" value="main-stage" />
          <label className="mt-3 block text-sm font-bold">Attendee ID or email hash</label><input name="attendeeId" required className="mt-1 min-h-10 w-full rounded-full border border-slate-200 px-4 text-sm" placeholder="attendee-id-from-registration" />
          <label className="mt-3 inline-flex items-center gap-2 text-sm"><input name="canJoinLiveStream" type="checkbox" defaultChecked /> Permit live-stage entry/watch</label>
          <label className="ml-4 inline-flex items-center gap-2 text-sm"><input name="approvedForStage" type="checkbox" /> Approve to publish on main stage</label>
          <label className="ml-4 inline-flex items-center gap-2 text-sm"><input name="canPublishCamera" type="checkbox" /> Camera</label>
          <label className="ml-4 inline-flex items-center gap-2 text-sm"><input name="canPublishMicrophone" type="checkbox" /> Microphone</label>
          <label className="ml-4 inline-flex items-center gap-2 text-sm"><input name="revoked" type="checkbox" /> Revoke live access</label>
          <input name="revokedReason" className="ml-4 min-h-10 rounded-full border border-slate-200 px-4 text-sm" placeholder="optional revoke reason" />
          <button className="ml-4 rounded-full border border-slate-300 px-4 py-2 text-xs font-black">Apply live access decision</button>
        </form>
      </details>
    </section>
  );
}
