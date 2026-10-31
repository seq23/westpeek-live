import { LocalTime } from "@/components/shared/LocalTime";
import { logIncidentAction, setIncidentStatusAction } from "@/lib/actions/incidentActions";
import { INCIDENT_SEVERITIES, listEventIncidents, type Incident } from "@/services/incidents/incidentLog";

const SEVERITY_TONE: Record<Incident["severity"], string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-red-100 text-red-800",
};

/**
 * This event's incident log, from D1: what happened, how serious, open or resolved, who logged it
 * (a person, or the app itself when the stage moved to a backup path or a video check failed).
 * Used on the workspace incident page and on the crew run of show, so crew can log one mid-show.
 */
export async function IncidentLog({ eventId, heading = "h2" }: { eventId: string; heading?: "h1" | "h2" }) {
  const incidents = await listEventIncidents(eventId);
  const open = incidents.filter((incident) => incident.status !== "resolved");
  const Heading = heading;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="incident-log" data-incident-count={incidents.length}>
      <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Incidents</p>
      <Heading className="mt-2 text-3xl font-black text-slate-950">Incident log</Heading>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        {incidents.length ? `${open.length} open, ${incidents.length - open.length} resolved.` : "Write down anything that went wrong, however small. The app adds an entry by itself when the stage moves to a backup path or a video check fails."}
      </p>

      <form action={logIncidentAction} className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="incident-form">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-800">
          What happened
          <input name="title" required maxLength={160} placeholder="Speaker audio dropped for 30 seconds" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal" data-testid="incident-title" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-800">
          More detail (optional)
          <textarea name="details" maxLength={2000} rows={2} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal" data-testid="incident-details" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-800">
            How serious
            <select name="severity" defaultValue="medium" className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal" data-testid="incident-severity">
              {INCIDENT_SEVERITIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-800">
            Status
            <select name="status" defaultValue="open" className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal" data-testid="incident-status">
              <option value="open">Open: still being dealt with</option>
              <option value="resolved">Resolved: already fixed</option>
            </select>
          </label>
        </div>
        <div><button className="min-h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid="incident-submit">Log incident</button></div>
      </form>

      {incidents.length ? (
        <ol className="mt-5 space-y-3" data-testid="incident-rows">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-2xl border border-slate-200 p-4" data-testid="incident-row" data-status={incident.status} data-source={incident.source || "manual"}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold text-slate-950">{incident.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${SEVERITY_TONE[incident.severity] || SEVERITY_TONE.medium}`}>{incident.severity}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${incident.status === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-slate-950 text-white"}`}>{incident.status === "resolved" ? "resolved" : "open"}</span>
                </div>
              </div>
              {incident.details ? <p className="mt-2 text-sm text-slate-600">{incident.details}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                {incident.source === "automatic" ? "Logged by the app" : `Logged by ${incident.reportedBy || incident.ownerRole || "the team"}`} · <LocalTime iso={incident.createdAt} />
                {incident.resolvedAt ? <> · resolved <LocalTime iso={incident.resolvedAt} /></> : null}
              </p>
              <form action={setIncidentStatusAction} className="mt-3">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="incidentId" value={incident.id} />
                <input type="hidden" name="status" value={incident.status === "resolved" ? "open" : "resolved"} />
                <button className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-800" data-testid="incident-toggle">{incident.status === "resolved" ? "Reopen" : "Mark resolved"}</button>
              </form>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600" data-testid="incident-empty">No incidents logged for this event.</p>
      )}
    </section>
  );
}
