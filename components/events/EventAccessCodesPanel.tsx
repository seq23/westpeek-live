import { CopyButton } from "@/components/shared/CopyButton";
import { joinLinkFor } from "@/components/events/EventJoinCodePanel";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { displayCode, guestGatePath, type AccessCodeField } from "@/lib/access/accessCodes";
import { setEventAccessCodeAction } from "@/lib/actions/accessCodeActions";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { describeCodeChangeImpact, liveSupersededCodesFor } from "@/services/events/supersededCodeService";
import { SUPERSEDED_CODE_WINDOW_DAYS, supersededOnLabel } from "@/types/supersededCode";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

const roleRows: Array<{ key: Exclude<AccessCodeField, "join">; testId: string; label: string; who: string; lands: (event: RuntimeEventRecord) => string }> = [
  { key: "crew", testId: "generated-crew-lite-code", label: "Crew", who: "People hired for the day; they pick their role at the gate.", lands: (event) => `/crew/events/${event.id}` },
  { key: "speaker", testId: "generated-speaker-code", label: "Speaker", who: "Green room, tech check, cue cards.", lands: (event) => `/speaker/events/${event.id}` },
  { key: "sponsor", testId: "generated-sponsor-code", label: "Sponsor", who: "Booth setup and leads.", lands: (event) => `/sponsor/events/${event.id}` },
  { key: "vip", testId: "generated-vip-code", label: "VIP", who: "The lobby badge and the VIP lounge.", lands: (event) => `/venue/${event.id}/lobby` },
  { key: "client", testId: "generated-client-code", label: "Client", who: "Read-only overview.", lands: (event) => `/client/${event.clientSlug}/events/${event.id}` },
];

function CodeEditor({ eventId, field, viewer, current }: { eventId: string; field: AccessCodeField; viewer: CrewViewer; current: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`code-editor-${field}`}>
      <GatedForm viewer={viewer} action="manage_access_codes" formAction={setEventAccessCodeAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="field" value={field} />
        <input name="value" defaultValue={displayCode(current)} pattern="[A-Za-z0-9-]{4,24}" title="4–24 letters, digits, or hyphens" className="min-h-9 w-44 rounded-full border border-brand-line px-3 font-mono text-xs uppercase" data-testid={`code-input-${field}`} />
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" data-testid={`code-save-${field}`}>Set code</button>
      </GatedForm>
      <GatedForm viewer={viewer} action="manage_access_codes" formAction={setEventAccessCodeAction} className="inline">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="field" value={field} /><input type="hidden" name="regenerate" value="true" />
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" data-testid={`code-regenerate-${field}`}>Regenerate</button>
      </GatedForm>
    </div>
  );
}

/**
 * Per-event codes, shown UPPERCASE, each with Copy code and Copy link — the link opens the right
 * gate with both fields prefilled so the person only presses Continue. The owner, operator, and
 * producers can set any code by hand (4–24 letters / digits / hyphens; unique) or regenerate it;
 * a change rotates the old code out at once.
 */
export async function EventAccessCodesPanel({ event, notice }: { event: RuntimeEventRecord; notice?: { saved?: string; error?: string; field?: string } }) {
  const [joinLink, base, viewer, impact, superseded] = await Promise.all([joinLinkFor(event), appBaseUrl(), getCrewViewer(event.id), describeCodeChangeImpact(event.id), liveSupersededCodesFor(event.id)]);
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm" data-testid="generated-event-role-codes">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Access codes for {event.name}</p>
      <p className="mt-2 text-sm text-brand-muted">Codes are shown in capitals and accepted in any case, with or without the dash. Send the link and the person only presses Continue; or read them the event code <strong>{displayCode(event.joinCode)}</strong> plus their role code.</p>
      {notice?.saved ? <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="code-saved-notice">The {notice.saved === "join" ? "join" : notice.saved} code is set. The old one stopped working{notice.saved === "crew" ? "; every crew link and crew session minted with it is over" : notice.saved === "join" ? "" : "; anyone who entered with it is sent back to the gate"}.</p> : null}
      {notice?.error ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900" data-testid="code-error-notice">{notice.field ? `${notice.field} code: ` : ""}{notice.error}</p> : null}
      <DeniedNote viewer={viewer} action="manage_access_codes" className="mt-3" />
      {superseded.length ? (
        <details className="mt-3 rounded-2xl bg-brand-ash p-3 text-xs" data-testid="superseded-codes" data-count={superseded.length}>
          <summary className="cursor-pointer font-black">Codes this event has retired ({superseded.length})</summary>
          <p className="mt-1 text-brand-muted">Kept for {SUPERSEDED_CODE_WINDOW_DAYS} days so an old link can be answered honestly. An old event code still lands attendees here; an old role code is refused and told when it changed.</p>
          <ul className="mt-2 space-y-1">
            {superseded.map((record) => (
              <li key={record.id} data-testid={`superseded-code-${record.field}`}>
                <code className="font-mono font-bold">{record.code}</code> — the {record.field === "join" ? "event" : record.field} code until {supersededOnLabel(record.replacedAt)}.
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="mt-4 rounded-2xl bg-brand-ash p-4" data-testid="access-code-row-join">
        <p className="text-xs font-black uppercase tracking-wide text-brand-muted">Attendee join</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-xl font-black" data-testid="access-join-code">{displayCode(event.joinCode)}</span>
          <CopyButton value={displayCode(event.joinCode)} label="Copy code" />
          <CopyButton value={joinLink} label="Copy join link" testId="copy-join-link" />
        </div>
        <p className="mt-2 text-xs text-brand-muted" data-testid="access-impact-join">{impact.lines.join} For {SUPERSEDED_CODE_WINDOW_DAYS} days after a change the old event code still lands them here, with a line saying it changed.</p>
        <CodeEditor eventId={event.id} field="join" viewer={viewer} current={event.joinCode} />
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {roleRows.map((row) => {
          const link = `${base}${guestGatePath(event, row.key)}`;
          return (
            <div key={row.key} className="rounded-2xl border border-brand-line p-4" data-testid={`access-code-row-${row.key}`}>
              <dt className="text-xs font-black uppercase tracking-wide text-brand-muted">{row.label}</dt>
              <dd className="mt-2 flex flex-wrap items-center gap-3">
                <code className="rounded bg-brand-ash px-2 py-1 font-mono text-sm font-bold" data-testid={row.testId}>{displayCode(event.accessCodes[row.key])}</code>
                <CopyButton value={displayCode(event.accessCodes[row.key])} label="Copy" testId={`copy-${row.key}-code`} />
                <CopyButton value={link} label="Copy link" testId={`copy-${row.key}-link`} />
              </dd>
              <p className="mt-2 text-xs text-brand-muted">{row.who} The link opens the gate prefilled → lands on {row.lands(event)}.</p>
              <p className="mt-1 text-xs text-brand-muted" data-testid={`access-impact-${row.key}`}>{impact.lines[row.key]} A replaced role code is refused from then on; the holder is told it changed and to ask the producer.</p>
              <CodeEditor eventId={event.id} field={row.key} viewer={viewer} current={event.accessCodes[row.key]} />
            </div>
          );
        })}
      </dl>
    </section>
  );
}
