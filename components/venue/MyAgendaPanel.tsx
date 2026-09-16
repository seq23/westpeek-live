import { updateMyAgendaAction } from "@/lib/actions/attendeeAgendaActions";
import { getAttendeeAgendaIntent } from "@/services/attendees/attendeeAgendaIntentService";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import type { VirtualVenueModel } from "@/types/virtualVenue";

export async function MyAgendaPanel({ model }: { model: VirtualVenueModel }) {
  const profile = await getCurrentAttendeeProfile(model.eventId);
  if (!profile) return <section className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600" data-testid="my-agenda-signed-out"><h2 className="text-lg font-black text-slate-950">My Agenda</h2><p className="mt-1"><a href={`/events/${model.eventId}/register`} className="font-bold text-brand-orange underline">Register</a> to save your agenda and profile.</p></section>;
  const intent = await getAttendeeAgendaIntent(model.eventId, profile.attendeeId).catch(() => undefined);
  const plannedSessions = model.sessions.filter((session) => intent?.plannedSessionIds.includes(session.id));
  const plannedBreakouts = model.breakouts.filter((breakout) => intent?.plannedBreakoutIds.includes(breakout.id));
  const plannedBooths = model.booths.filter((booth) => intent?.plannedSponsorBoothIds.includes(booth.id));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="my-agenda-panel">
      <h2 className="text-lg font-black text-slate-950">My Agenda</h2>
      <p className="mt-1 text-sm text-slate-600">Saved for {profile.name}. Planning is identity state, not access permission.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[['Sessions', plannedSessions.map((item) => item.title)], ['Breakouts', plannedBreakouts.map((item) => item.title)], ['Sponsor booths', plannedBooths.map((item) => item.name)]].map(([label, items]) => (
          <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>{(items as string[]).length ? (items as string[]).map((item) => <p key={item} className="mt-2 text-sm font-semibold text-slate-800">{item}</p>) : <p className="mt-2 text-sm text-slate-500">Nothing planned yet.</p>}</div>
        ))}
      </div>
    <form action={updateMyAgendaAction} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="edit-my-agenda-form">
        <input type="hidden" name="eventId" value={model.eventId} />
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Edit later</p>
        <p className="mt-1 text-xs text-slate-500">Change planning selections without changing access permission.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>{model.sessions.slice(0, 6).map((session) => <label key={session.id} className="block text-xs"><input type="checkbox" name="plannedSessionIds" value={session.id} defaultChecked={intent?.plannedSessionIds.includes(session.id)} /> {session.title}</label>)}</div>
          <div>{model.breakouts.slice(0, 6).map((breakout) => <label key={breakout.id} className="block text-xs"><input type="checkbox" name="plannedBreakoutIds" value={breakout.id} defaultChecked={intent?.plannedBreakoutIds.includes(breakout.id)} /> {breakout.title}</label>)}</div>
          <div>{model.booths.slice(0, 6).map((booth) => <label key={booth.id} className="block text-xs"><input type="checkbox" name="plannedSponsorBoothIds" value={booth.id} defaultChecked={intent?.plannedSponsorBoothIds.includes(booth.id)} /> {booth.name}</label>)}</div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="wantsSessionReminders" defaultChecked={Boolean(intent?.wantsSessionReminders)} /> Reminders</label>
        <button className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Update My Agenda</button>
      </form>
    </section>
  );
}
