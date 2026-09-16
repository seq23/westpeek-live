import { getEvent } from "@/lib/runtime/getRuntimeData";
import { getEventPublishState, getPublishReadiness, canPublishEvent } from "@/services/events/eventPublishService";
import { peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import { publishEventAction } from "@/lib/actions/eventWorkspaceActions";
import { ManageEventTabs } from "@/components/events/ManageEventTabs";
import { EventJoinCodePanel } from "@/components/events/EventJoinCodePanel";
import { StatusBadge } from "@/components/shared/StatusBadge";

const transitions: Array<{ status: "registration_open" | "pre_event" | "live" | "ended" | "draft"; label: string; help: string; primary?: boolean }> = [
  { status: "registration_open", label: "Publish", help: "Opens the join code and the public event page.", primary: true },
  { status: "pre_event", label: "Mark pre-event", help: "Published; attendees see the countdown state." },
  { status: "live", label: "Go live", help: "Sends /join straight into the lobby.", primary: true },
  { status: "ended", label: "End event", help: "Attendees get the replay state." },
  { status: "draft", label: "Back to draft", help: "Closes the join code again." },
];

export function EventPublishPanel({ eventId, updated, error }: { eventId: string; updated?: string; error?: string }) {
  const event = getEvent(eventId);
  const runtime = peekOverlayEvent(eventId);
  const state = getEventPublishState(eventId);
  const readiness = getPublishReadiness(eventId);
  const ready = canPublishEvent(eventId);
  const currentStatus = runtime?.status || event.status;

  return (
    <div className="space-y-6">
      <ManageEventTabs eventId={eventId} />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Publishing</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black text-slate-950">Publish {event.name}</h1>
          <StatusBadge status={currentStatus} tone={currentStatus === "live" ? "good" : "neutral"} />
        </div>
        {runtime ? (
          <>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Status changes save to the event row immediately — no PR, no redeploy. Publish opens the join code; Go live sends attendees straight into the lobby.</p>
            {updated ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="publish-updated">Status is now {updated.replaceAll("_", " ")}.</p> : null}
            {error ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{error}</p> : null}
            <div className="mt-5"><EventJoinCodePanel event={runtime} /></div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {transitions.filter((transition) => transition.status !== currentStatus).map((transition) => (
                <form key={transition.status} action={publishEventAction} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <input type="hidden" name="eventId" value={runtime.id} />
                  <input type="hidden" name="status" value={transition.status} />
                  <div>
                    <p className="font-bold text-slate-950">{transition.label}</p>
                    <p className="text-xs text-slate-500">{transition.help}</p>
                  </div>
                  <button type="submit" className={`rounded-full px-4 py-2 text-sm font-bold ${transition.primary ? "bg-brand-black text-white hover:bg-brand-orange" : "border border-slate-300 text-slate-800"}`} data-testid={`publish-${transition.status}`}>{transition.label}</button>
                </form>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">This is a compiled demo/seed event. Its status lives in data/events and changes through the config-package PR flow, not from this page.</p>
            <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-sm font-bold">Current publish state: {state.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm text-slate-300">Actions-first publishing is the primary path. PR automation and config package export remain fallbacks. The app must never direct-commit to main.</p>
            </div>
          </>
        )}
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {readiness.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-950">{item.label}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === "pass" ? "bg-emerald-100 text-emerald-800" : item.status === "warning" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{item.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
        {!runtime ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white" disabled={!ready}>Mark ready for review</button>
            <button className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800">Generate config package</button>
            <button className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800">Open GitHub Actions checklist</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
