import { updateMyAgendaAction } from "@/lib/actions/attendeeAgendaActions";
import { getAttendeeAgendaIntent } from "@/services/attendees/attendeeAgendaIntentService";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { VenueSection } from "@/components/venue/VenueSection";
import { LocalTimeWindow } from "@/components/shared/LocalTimeWindow";
import type { VirtualVenueModel } from "@/types/virtualVenue";

/**
 * The attendee's own shortlist. Collapsed by default — it is a side errand, not the reason anyone
 * came. The copy is in the owner's voice: "Planning is identity state, not access permission" was
 * on screen in front of guests (16 Sep 2026), and nobody outside this repo knows what it means.
 * Picking sessions has never changed what a person is allowed into, so we simply do not raise it.
 */
export async function MyAgendaPanel({ model }: { model: VirtualVenueModel }) {
  const profile = await getCurrentAttendeeProfile(model.eventId);
  if (!profile) return <section className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600" data-testid="my-agenda-signed-out"><h2 className="text-lg font-black text-slate-950">My plan</h2><p className="mt-1"><a href={`/events/${model.eventId}/register`} className="font-bold text-brand-orange underline">Register</a> to keep a list of what you want to catch.</p></section>;
  const intent = await getAttendeeAgendaIntent(model.eventId, profile.attendeeId).catch(() => undefined);
  const plannedSessions = model.sessions.filter((session) => intent?.plannedSessionIds.includes(session.id));
  const plannedBreakouts = model.breakouts.filter((breakout) => intent?.plannedBreakoutIds.includes(breakout.id));
  const plannedBooths = model.booths.filter((booth) => intent?.plannedSponsorBoothIds.includes(booth.id));
  const picked = plannedSessions.length + plannedBreakouts.length + plannedBooths.length;
  return (
    <VenueSection storageKey={`my-plan-${model.eventId}`} testId="my-agenda-panel" eyebrow="Yours" title="My plan" summary={picked ? `${picked} thing${picked === 1 ? "" : "s"} on your list.` : "Nothing on your list yet. Tick what you want to catch."}>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Sessions</p>
          {plannedSessions.length ? plannedSessions.map((session) => <p key={session.id} className="mt-2 text-sm font-semibold text-slate-800">{session.title}<br /><span className="text-xs font-normal text-slate-500"><LocalTimeWindow startsAt={session.startsAt} endsAt={session.endsAt} /></span></p>) : <p className="mt-2 text-sm text-slate-500">Nothing picked yet.</p>}
        </div>
        {[["Breakouts", plannedBreakouts.map((item) => item.title)], ["Sponsor booths", plannedBooths.map((item) => item.name)]].map(([label, items]) => (
          <div key={String(label)} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>{(items as string[]).length ? (items as string[]).map((item) => <p key={item} className="mt-2 text-sm font-semibold text-slate-800">{item}</p>) : <p className="mt-2 text-sm text-slate-500">Nothing picked yet.</p>}</div>
        ))}
      </div>
      <form action={updateMyAgendaAction} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3" data-testid="edit-my-agenda-form">
        <input type="hidden" name="eventId" value={model.eventId} />
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Change your list</p>
        <p className="mt-1 text-xs text-slate-500">Tick anything you want to catch. You can come back and change it whenever you like.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>{model.sessions.slice(0, 6).map((session) => <label key={session.id} className="block text-xs"><input type="checkbox" name="plannedSessionIds" value={session.id} defaultChecked={intent?.plannedSessionIds.includes(session.id)} /> {session.title}</label>)}</div>
          <div>{model.breakouts.slice(0, 6).map((breakout) => <label key={breakout.id} className="block text-xs"><input type="checkbox" name="plannedBreakoutIds" value={breakout.id} defaultChecked={intent?.plannedBreakoutIds.includes(breakout.id)} /> {breakout.title}</label>)}</div>
          <div>{model.booths.slice(0, 6).map((booth) => <label key={booth.id} className="block text-xs"><input type="checkbox" name="plannedSponsorBoothIds" value={booth.id} defaultChecked={intent?.plannedSponsorBoothIds.includes(booth.id)} /> {booth.name}</label>)}</div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="wantsSessionReminders" defaultChecked={Boolean(intent?.wantsSessionReminders)} /> Remind me before something on my list starts.</label>
        <button className="mt-3 min-h-11 rounded-full bg-slate-950 px-5 text-xs font-black text-white">Save my plan</button>
      </form>
    </VenueSection>
  );
}
