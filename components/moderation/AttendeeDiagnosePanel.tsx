import type { ReactNode } from "react";
import { LocalTime } from "@/components/shared/LocalTime";
import { previewMirrorId } from "@/lib/auth/previewIdentity";
import { VERDICT_LABEL, type AttendeeDiagnosis } from "@/services/venue/attendeeDiagnosticsService";
import { liveStatusLabel, type AttendeeRosterRow } from "@/services/venue/attendeeRosterService";

const TONE: Record<string, string> = {
  watching: "bg-emerald-50 text-emerald-900 border-emerald-200",
  never_connected: "bg-rose-50 text-rose-900 border-rose-200",
  receiving_nothing: "bg-rose-50 text-rose-900 border-rose-200",
  poor_connection: "bg-amber-50 text-amber-900 border-amber-200",
  nothing_on_air: "bg-amber-50 text-amber-900 border-amber-200",
  unknown: "bg-slate-100 text-slate-700 border-slate-300",
};

function Field({ label, value, source }: { label: string; value: ReactNode; source: ReactNode }) {
  return (
    <div className="border-t border-slate-100 py-1.5">
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-xs font-bold text-slate-900">{value}</dd>
      <dd className="text-[10px] text-slate-400">{source}</dd>
    </div>
  );
}

const NOT_REPORTED = <span className="text-slate-400">Not reported</span>;

/**
 * Everything we actually know about one attendee, and nothing we do not.
 *
 * Two sources, never blurred: LiveKit's RoomService says whether they are in the room and what is on
 * air; their own browser says what it is subscribed to and how good the connection is (LiveKit keeps
 * both of those client-side, so there is no server answer to borrow). Every row names its source and
 * when it was read, and a probe that did not run prints "Not reported" rather than a reassuring blank.
 *
 * Opening it is a NAVIGATION (`?diagnose=<id>`), not a client toggle, so looking at a named person is
 * a server request the audit log can record. The line at the bottom is load-bearing: this is their
 * STATE, not their screen.
 */
export function AttendeeDiagnosePanel({ eventId, row, diagnosis, openHref, closeHref, returnTo, open }: { eventId: string; row: AttendeeRosterRow; diagnosis?: AttendeeDiagnosis; openHref: string; closeHref: string; returnTo: string; open: boolean }) {
  if (!open || !diagnosis) {
    return <a href={openHref} className="inline-block rounded-full border border-slate-300 px-3 py-1 text-xs font-black text-slate-800 hover:border-brand-orange hover:text-brand-orange" data-testid={`diagnose-${row.attendeeId}`}>Diagnose</a>;
  }
  const { participant, session } = diagnosis;
  const build = session?.clientBuildId;
  return (
    <div className="mt-1 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" data-testid={`diagnose-panel-${row.attendeeId}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`rounded-xl border px-3 py-2 text-xs font-black ${TONE[diagnosis.verdict]}`} data-testid={`diagnose-verdict-${row.attendeeId}`} data-verdict={diagnosis.verdict}>{VERDICT_LABEL[diagnosis.verdict]}</p>
        <a href={closeHref} className="text-xs font-black text-slate-400 hover:text-slate-800" data-testid={`diagnose-close-${row.attendeeId}`}>Close</a>
      </div>
      <p className="mt-2 text-xs text-slate-700" data-testid={`diagnose-headline-${row.attendeeId}`}>{diagnosis.headline}</p>
      <dl className="mt-2">
        <Field
          label="In the stage room"
          value={participant ? <>Yes · {participant.state || "state unreported"}{participant.joinedAt ? <> · since <LocalTime iso={participant.joinedAt} mode="datetime" /></> : null}</> : diagnosis.livekitReachable ? "No participant for their identity" : NOT_REPORTED}
          source={diagnosis.livekitReachable ? <>LiveKit RoomService, read <LocalTime iso={diagnosis.livekitCheckedAt} mode="datetime" /></> : `LiveKit unreadable — ${diagnosis.livekitReason || "no reason given"}`}
        />
        <Field label="Connection quality" value={session?.clientConnectionQuality || NOT_REPORTED} source="Their browser, on the stage heartbeat — LiveKit keeps quality client-side" />
        <Field label="Subscribed to" value={session?.clientSubscribedTracks === undefined ? NOT_REPORTED : `${session.clientSubscribedTracks} track${session.clientSubscribedTracks === 1 ? "" : "s"}`} source="Their browser — the real answer to “is the video reaching them”" />
        <Field label="On air for them to receive" value={diagnosis.livekitReachable ? `${diagnosis.publishingTracks} unmuted track${diagnosis.publishingTracks === 1 ? "" : "s"} published` : NOT_REPORTED} source="LiveKit RoomService participant track list" />
        <Field label="Their app build" value={build ? <>{build} {diagnosis.buildMatchesCurrent ? <span className="text-emerald-700">· current</span> : <span className="text-amber-700">· stale, current is {diagnosis.currentBuildId}</span>}</> : NOT_REPORTED} source="Build-version heartbeat, the same one the deploy watchdog uses" />
        <Field label="Browser and device" value={session?.clientBrowser || NOT_REPORTED} source="Derived from their user agent; the raw string is never stored" />
        <Field label="Our roster state" value={<>{liveStatusLabel(row.liveStatus)} · chat {row.silenced ? "silenced" : "open"}</>} source="Our own records" />
        <Field
          label="Last seen · last chat poll"
          value={<>{session?.lastSeenAt ? <LocalTime iso={session.lastSeenAt} mode="datetime" /> : NOT_REPORTED} · {session?.lastChatPollAt ? <LocalTime iso={session.lastChatPollAt} mode="datetime" /> : NOT_REPORTED}</>}
          source="Their heartbeat and their chat poll"
        />
      </dl>
      <p className="mt-2 rounded-xl bg-slate-50 p-2 text-[11px] font-bold text-slate-600" data-testid={`diagnose-state-not-screen-${row.attendeeId}`}>This is their reported state, not their screen. We cannot see their monitor.</p>
      <a href={`/venue/${eventId}/stage?viewAs=${previewMirrorId(row.attendeeId)}&leaveTo=${encodeURIComponent(returnTo)}`} className="mt-2 inline-block rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white hover:bg-brand-orange" data-testid={`see-their-view-${row.attendeeId}`}>See their view</a>
    </div>
  );
}
