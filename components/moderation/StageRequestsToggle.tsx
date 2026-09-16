import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { setStageRequestsOpenAction } from "@/lib/actions/attendeeLiveActions";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { getAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";
import { COMMAND_CHIP_MUTED } from "@/components/command/commandChrome";

/**
 * "Stage requests: Open / Closed" — one switch on the crew deck header and on each Live-now row of
 * the Owner Console. Open = anyone can raise a hand, the crew approves who gets on. Closed =
 * attendees see "the crew has closed stage requests for now". Camera and mic requests move
 * together; approval stays required; the granular checkboxes remain in the room-controls fold.
 *
 * `variant="bar"` is the same switch sized for the Event Command Bar — one pill that reads the
 * state and flips it. Same service, same action, same permission: a second implementation would
 * have drifted from this one within a show.
 */
export async function StageRequestsToggle({ eventId, viewer: givenViewer, compact = false, variant = "card" }: { eventId: string; viewer?: CrewViewer; compact?: boolean; variant?: "card" | "bar" }) {
  const [control, viewer] = await Promise.all([getAttendeeLiveControlState(eventId, "main_stage", "main-stage"), givenViewer ? Promise.resolve(givenViewer) : getCrewViewer(eventId)]);
  const open = control.globalCameraEnabled || control.globalMicrophoneEnabled;
  if (variant === "bar") {
    return (
      <GatedForm viewer={viewer} action="manage_stage_access" formAction={setStageRequestsOpenAction} testId="stage-requests-toggle">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="open" value={open ? "false" : "true"} />
        <button className={`flex items-center gap-1.5 ${COMMAND_CHIP_MUTED} disabled:cursor-not-allowed disabled:opacity-40`} data-testid="stage-requests-switch" title={open ? "Open: anyone can raise a hand, you approve who gets on. Press to close." : "Closed: attendees see “the crew has closed stage requests for now”. Press to open."}>
          Stage requests <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${open ? "bg-emerald-400 text-emerald-950" : "bg-slate-500 text-white"}`} data-testid="stage-requests-state">{open ? "Open" : "Closed"}</span>
        </button>
      </GatedForm>
    );
  }
  return (
    <div className={`rounded-2xl border ${open ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"} ${compact ? "p-3" : "p-4"}`} data-testid="stage-requests-toggle" data-open={open ? "true" : "false"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Stage requests</p>
          <p className="text-lg font-black text-slate-950" data-testid="stage-requests-state">{open ? "Open" : "Closed"}</p>
          <p className="mt-1 text-xs text-slate-600">{open ? "Open: anyone can raise a hand, you approve who gets on." : "Closed: attendees see “the crew has closed stage requests for now”."}</p>
        </div>
        <GatedForm viewer={viewer} action="manage_stage_access" formAction={setStageRequestsOpenAction}>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="open" value={open ? "false" : "true"} />
          <button className={`min-h-11 rounded-full px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40 ${open ? "border border-rose-300 text-rose-800" : "bg-slate-950 text-white"}`} data-testid="stage-requests-switch">{open ? "Close stage requests" : "Open stage requests"}</button>
        </GatedForm>
      </div>
      {!compact ? <DeniedNote viewer={viewer} action="manage_stage_access" className="mt-2" /> : null}
    </div>
  );
}
