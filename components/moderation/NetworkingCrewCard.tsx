import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { updateNetworkingSettingsAction } from "@/lib/actions/networkingActions";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { crewNetworkingSummary } from "@/services/speed-networking/speedNetworkingService";

/**
 * The crew's Networking card: queue size, matches in progress (who with whom, time left), the
 * minutes-per-match setting, and Open / close networking. Every read runs the matcher.
 */
export async function NetworkingCrewCard({ eventId, viewer: givenViewer }: { eventId: string; viewer?: CrewViewer }) {
  const [summary, viewer] = await Promise.all([crewNetworkingSummary(eventId), givenViewer ? Promise.resolve(givenViewer) : getCrewViewer(eventId)]);
  const { settings } = summary;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="networking-crew-card" data-open={settings.open ? "true" : "false"} data-queue-size={summary.queueSize} data-matches-in-progress={summary.matchesInProgress} data-match-minutes={settings.matchMinutes}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Networking</p>
          <h2 className="mt-2 text-xl font-black text-slate-950"><span data-testid="networking-queue-size">{summary.queueSize}</span> in the queue · <span data-testid="networking-matches-in-progress">{summary.matchesInProgress}</span> match{summary.matchesInProgress === 1 ? "" : "es"} in progress · {summary.matchesTotal} so far</h2>
          <p className="mt-1 text-sm text-slate-600">{settings.open ? `Open · ${settings.matchMinutes} minutes per match. Two waiting attendees are paired on the next poll; a pair never meets twice.` : "Closed · attendees see \"The crew has closed networking for now\"; anyone matched finishes their current match."}</p>
        </div>
        <GatedForm viewer={viewer} action="manage_stage_access" formAction={updateNetworkingSettingsAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="open" value={settings.open ? "false" : "true"} /><input type="hidden" name="matchMinutes" value={settings.matchMinutes} />
          <button className={`rounded-full px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${settings.open ? "border border-rose-300 text-rose-800" : "bg-slate-950 text-white"}`} data-testid="networking-toggle-open">{settings.open ? "Close networking" : "Open networking"}</button>
        </GatedForm>
      </div>
      <DeniedNote viewer={viewer} action="manage_stage_access" className="mt-3" />
      <GatedForm viewer={viewer} action="manage_stage_access" formAction={updateNetworkingSettingsAction} className="mt-3 flex flex-wrap items-center gap-2" testId="networking-minutes-form">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="open" value={settings.open ? "true" : "false"} />
        <label className="text-xs font-bold text-slate-700" htmlFor={`networking-minutes-${eventId}`}>Minutes per match</label>
        <input id={`networking-minutes-${eventId}`} name="matchMinutes" type="number" min={1} max={30} defaultValue={settings.matchMinutes} className="w-20 rounded-full border border-slate-300 px-3 py-1 text-sm" data-testid="networking-minutes-input" />
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" data-testid="networking-minutes-save">Save</button>
        <span className="text-xs text-slate-500">Applies to matches made from now on.</span>
      </GatedForm>
      {summary.active.length ? (
        <ul className="mt-3 space-y-1 text-sm text-slate-700" data-testid="networking-active-matches">
          {summary.active.map((match) => <li key={match.id} data-testid={`networking-match-${match.id}`}><strong>{match.a}</strong> ↔ <strong>{match.b}</strong> · {Math.max(0, Math.round((new Date(match.expiresAt).getTime() - Date.now()) / 60_000))} min left · room <code className="text-[11px] text-slate-400">{match.roomName}</code></li>)}
        </ul>
      ) : null}
      {summary.waiting.length ? <p className="mt-2 text-xs text-slate-500" data-testid="networking-waiting-names">Waiting: {summary.waiting.map((entry) => entry.displayName).join(", ")}</p> : null}
    </section>
  );
}
