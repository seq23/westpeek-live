import { getAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";
import { LocalTime } from "@/components/shared/LocalTime";
import { decideAttendeeLiveAccess } from "@/lib/actions/attendeeLiveActions";
import { silenceLiveChatAttendee } from "@/lib/actions/liveChatActions";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { getAttendeeRoster, liveStatusLabel, ROSTER_LIMIT, type AttendeeRosterRow } from "@/services/venue/attendeeRosterService";
import type { AttendeeLiveDecision, AttendeeLiveRoomKind } from "@/types/attendeeLive";

function when(value?: string) {
  if (!value) return "—";
  return value.includes("T") ? <LocalTime iso={value} mode="datetime" /> : value;
}

function DecisionButton({ eventId, roomKind, roomId, attendeeId, decision, label, tone = "neutral", viewer }: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; attendeeId: string; decision: AttendeeLiveDecision; label: string; tone?: "neutral" | "primary" | "danger" | "restore"; viewer: CrewViewer }) {
  const className = tone === "primary" ? "bg-slate-950 text-white" : tone === "danger" ? "border border-rose-300 text-rose-800" : tone === "restore" ? "border border-emerald-300 text-emerald-800" : "border border-slate-300 text-slate-800";
  return (
    <GatedForm viewer={viewer} action="manage_stage_access" formAction={decideAttendeeLiveAccess} className="inline">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value={roomKind} /><input type="hidden" name="roomId" value={roomId} /><input type="hidden" name="attendeeId" value={attendeeId} /><input type="hidden" name="decision" value={decision} />
      <button className={`rounded-full px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${className}`} data-testid={`roster-${decision}-${attendeeId}`}>{label}</button>
    </GatedForm>
  );
}

function StatusPill({ row }: { row: AttendeeRosterRow }) {
  const tone = row.liveStatus === "approved_to_publish" ? "bg-emerald-50 text-emerald-800" : row.liveStatus === "permitted" ? "bg-sky-50 text-sky-800" : row.liveStatus === "requested" ? "bg-amber-50 text-amber-800" : row.liveStatus === "revoked" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${tone}`} data-testid={`roster-status-${row.attendeeId}`} data-live-status={row.liveStatus}>{liveStatusLabel(row.liveStatus)}</span>;
}

function RowActions({ eventId, roomKind, roomId, row, viewer, joinRequiresApproval }: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; row: AttendeeRosterRow; viewer: CrewViewer; joinRequiresApproval: boolean }) {
  const base = { eventId, roomKind, roomId, attendeeId: row.attendeeId, viewer };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Watching is open to everyone unless the crew switched "require permit" on; a Permit button
          on every row read as if each person needed one (owner, 16 Sep 2026). */}
      {(joinRequiresApproval || row.liveStatus === "revoked") && row.liveStatus !== "permitted" && row.liveStatus !== "approved_to_publish" ? <DecisionButton {...base} decision="permit" label={row.liveStatus === "revoked" ? "Restore watching" : "Permit to watch"} tone={row.liveStatus === "revoked" ? "restore" : "neutral"} /> : null}
      {row.liveStatus !== "approved_to_publish" ? <DecisionButton {...base} decision="approve_publish" label="Approve to publish" tone="primary" /> : null}
      {row.liveStatus !== "revoked" ? <DecisionButton {...base} decision="revoke" label="Revoke" tone="danger" /> : null}
      {row.liveStatus === "requested" ? <DecisionButton {...base} decision="decline" label="Decline" tone="danger" /> : null}
      {row.liveStatus !== "open" ? <DecisionButton {...base} decision="reset" label="Reset" /> : null}
      <GatedForm viewer={viewer} action="moderate_chat" formAction={silenceLiveChatAttendee} className="inline">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="roomKind" value={roomKind} /><input type="hidden" name="roomId" value={roomId} /><input type="hidden" name="attendeeId" value={row.attendeeId} /><input type="hidden" name="silenced" value={row.silenced ? "false" : "true"} />
        <button className={`rounded-full border px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${row.silenced ? "border-emerald-300 text-emerald-800" : "border-slate-300 text-slate-800"}`} data-testid={`roster-${row.silenced ? "unsilence" : "silence"}-${row.attendeeId}`}>{row.silenced ? "Unsilence" : "Silence"}</button>
      </GatedForm>
    </div>
  );
}

/**
 * The attendee roster for a room: everyone registered (latest 200, searchable) with their live
 * status and one-click Permit / Approve to publish / Revoke / Silence, and the pending stage
 * requests at the top with Approve / Decline. Shared by the crew console, the event command
 * page, and the testing console. Every button is a guarded server action.
 */
export async function AttendeeLiveRoster({ eventId, roomKind = "main_stage", roomId = "main-stage", search = "", searchAction, viewer: givenViewer }: { eventId: string; roomKind?: AttendeeLiveRoomKind; roomId?: string; search?: string; searchAction: string; viewer?: CrewViewer }) {
  const [roster, viewer, control] = await Promise.all([getAttendeeRoster({ eventId, roomKind, roomId, search }), givenViewer ? Promise.resolve(givenViewer) : getCrewViewer(eventId), getAttendeeLiveControlState(eventId, roomKind, roomId).catch(() => undefined)]);
  const joinRequiresApproval = Boolean(control?.attendeeJoinRequiresApproval);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="attendee-live-roster">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Attendee roster · {roomKind === "main_stage" ? "main stage" : `${roomKind} ${roomId}`}</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">{roster.total} registered · {roster.pending.length} pending stage request{roster.pending.length === 1 ? "" : "s"}</h2>
      <p className="mt-2 text-sm text-slate-600">Permit lets an attendee watch the live stage when join approval is on. Approve to publish grants camera and microphone on the stage. Revoke removes both and drops them from the LiveKit room. Silence stops their chat in this room. Nothing here needs an attendee id typed by hand.</p>
      <DeniedNote viewer={viewer} action="manage_stage_access" className="mt-3" />

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="pending-stage-requests">
        <p className="text-xs font-black uppercase tracking-wide text-amber-800">Pending requests</p>
        {roster.pending.length ? (
          <ul className="mt-2 space-y-2">
            {roster.pending.map((row) => (
              <li key={row.attendeeId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3" data-testid={`pending-request-${row.attendeeId}`}>
                <div>
                  <p className="text-sm font-black text-slate-950">{row.name} <span className="font-medium text-slate-500">· {row.company}</span></p>
                  <p className="text-xs text-slate-500">Asked {when(row.capability?.requestedAt)} · <code>{row.attendeeId}</code></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DecisionButton eventId={eventId} roomKind={roomKind} roomId={roomId} attendeeId={row.attendeeId} decision="approve_publish" label="Approve" tone="primary" viewer={viewer} />
                  <DecisionButton eventId={eventId} roomKind={roomKind} roomId={roomId} attendeeId={row.attendeeId} decision="decline" label="Decline" tone="danger" viewer={viewer} />
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-amber-900">No one is waiting. Requests from &ldquo;Request to Join Stage&rdquo; appear here.</p>}
      </div>

      <form method="get" action={searchAction} className="mt-4 flex flex-wrap items-center gap-2" data-testid="roster-search-form">
        <label htmlFor={`roster-search-${roomKind}-${roomId}`} className="text-xs font-bold text-slate-600">Search</label>
        <input id={`roster-search-${roomKind}-${roomId}`} name="roster" defaultValue={search} placeholder="name, company, or attendee id" className="min-h-10 flex-1 rounded-full border border-slate-200 px-4 text-sm" />
        <button className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black">Filter</button>
        {search ? <a href={searchAction} className="text-xs font-bold text-slate-500 underline">Clear</a> : null}
        <span className="text-xs text-slate-500">Showing {roster.rows.length} of {roster.total} (latest {ROSTER_LIMIT}).</span>
      </form>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="roster-table">
          <thead className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            <tr><th className="py-2 pr-3">Attendee</th><th className="py-2 pr-3">Registered</th><th className="py-2 pr-3">Live status</th><th className="py-2 pr-3">Chat</th><th className="py-2">Decide</th></tr>
          </thead>
          <tbody>
            {roster.rows.length ? roster.rows.map((row) => (
              <tr key={row.attendeeId} className="border-t border-slate-100 align-top" data-testid={`roster-row-${row.attendeeId}`}>
                <td className="py-3 pr-3"><p className="font-black text-slate-950">{row.name}</p><p className="text-xs text-slate-500">{row.company}{row.title ? ` · ${row.title}` : ""}</p><code className="text-[11px] text-slate-400">{row.attendeeId}</code></td>
                <td className="py-3 pr-3 text-xs text-slate-600">{when(row.registeredAt)}</td>
                <td className="py-3 pr-3"><StatusPill row={row} />{row.capability?.revokedReason && row.liveStatus === "revoked" ? <p className="mt-1 text-xs text-slate-500">{row.capability.revokedReason}</p> : null}</td>
                <td className="py-3 pr-3 text-xs text-slate-600">{row.silenced ? <span className="font-black text-rose-800">Silenced</span> : "Open"}<p>Last: {when(row.lastChatAt)}</p></td>
                <td className="py-3"><RowActions eventId={eventId} roomKind={roomKind} roomId={roomId} row={row} viewer={viewer} joinRequiresApproval={joinRequiresApproval} /></td>
              </tr>
            )) : <tr><td colSpan={5} className="py-4 text-sm text-slate-500">{search ? `No registered attendee matches "${search}".` : "No registered attendees yet. Rows appear as people register with the join code."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
