import { SectionCard } from "@/components/shared/SectionCard";
import { getCrewViewer, viewerDenied } from "@/lib/auth/crewViewer";
import { sendGroupEmailAction } from "@/lib/actions/groupEmailActions";
import { describeAudience, resolveAudience } from "@/services/email/emailAudienceService";
import { emailConfiguration, MANUAL_WORKFLOWS } from "@/services/email/eventEmailService";
import { emailVolume } from "@/services/email/emailVolumeService";
import { listEventRecords } from "@/services/events/eventRepository";
import { AUDIENCE_OPTIONS, audienceOption, isAudienceKind, type EmailAudienceKind } from "@/types/emailAudience";

/**
 * One composer: event, audience, message, send.
 *
 * Before this, the owner could email seven named individuals from seven boxes on an event page and
 * could not email a group at all — not attendees, not VIPs, not crew. Her words: "i dont understand
 * why all the emailing of participants or crews or vips or clients or speakers isnt done on the
 * email tab".
 *
 * Three things on this screen are not decoration:
 *
 *   · the RESOLVED COUNT, shown before the send and expandable into the actual names and addresses,
 *     because a wrong audience is unrecoverable once it has gone;
 *   · the UNSUBSCRIBED figure beside it, so the number she confirms is the number that will be
 *     mailed rather than the number that exists;
 *   · the count travelling with the send as `expectedCount`, so a registration that lands between
 *     the confirm and the press refuses the send instead of quietly changing who gets it.
 */
export interface ComposerQuery {
  event?: string;
  audience?: string;
  oneOff?: string;
  workflow?: string;
  sent?: string;
  composeError?: string;
}

function selectedAudience(value: string | undefined): EmailAudienceKind {
  return value && isAudienceKind(value) ? value : "attendees";
}

export async function EmailComposer({ query }: { query?: ComposerQuery }) {
  const eventId = String(query?.event || "").trim();
  const audienceKind = selectedAudience(query?.audience);
  const oneOff = String(query?.oneOff || "").trim();
  const option = audienceOption(audienceKind)!;

  const [viewer, events, { configured, replyTo }, audience, volume] = await Promise.all([
    getCrewViewer(eventId || undefined),
    listEventRecords(),
    emailConfiguration(),
    resolveAudience({ kind: audienceKind, eventId: eventId || undefined, oneOff }),
    emailVolume(),
  ]);
  const denied = viewerDenied(viewer, "manage_access_codes");
  const overDaily = audience.ok && audience.members.length > volume.dailyRemaining;
  const canSend = audience.ok && !denied && !overDaily;

  return (
    <SectionCard title="Write to a group" eyebrow="Event · who it goes to · what it says · send">
      <div data-testid="email-composer" data-audience={audienceKind} data-count={audience.members.length} data-can-send={canSend ? "true" : "false"}>
        <p className={`rounded-2xl p-3 text-sm font-bold ${configured ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} data-testid="composer-provider-banner">
          {configured
            ? `Email is live through Resend${replyTo ? `, replies go to ${replyTo}` : ""}. Anything you send here really leaves the building.`
            : "Resend is not configured on this deployment, so nothing actually leaves: sends are recorded as mock so you can see the flow without mailing anyone."}
        </p>
        {query?.sent ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="composer-sent-note">Sent to {query.sent} {query.sent === "1" ? "person" : "people"}.</p> : null}
        {query?.composeError ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-900" data-testid="composer-error">{query.composeError}</p> : null}
        {denied ? <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900" role="note" data-testid="composer-denied">{denied}</p> : null}

        {/* 1 · Event and 2 · To. A GET form: picking an audience re-reads who is in it, and nothing
            is sent by choosing. Kept separate from the message so the page can resolve the real
            count before there is anything to send. */}
        <form method="get" action="/app/email/compose" className="mt-5 grid gap-3 md:grid-cols-3" data-testid="composer-audience-form">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Event
            <select name="event" defaultValue={eventId} className="rounded-xl border border-slate-300 px-3 py-2" data-testid="composer-event">
              <option value="">No event — people across events</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            To
            <select name="audience" defaultValue={audienceKind} className="rounded-xl border border-slate-300 px-3 py-2" data-testid="composer-audience">
              {AUDIENCE_OPTIONS.map((entry) => <option key={entry.kind} value={entry.kind}>{entry.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            {option.needsAddress ? "Their address" : "Address (only for “One person”)"}
            <input name="oneOff" type="email" defaultValue={oneOff} placeholder="ada@example.com" className="rounded-xl border border-slate-300 px-3 py-2" data-testid="composer-one-off" />
          </label>
          <div className="md:col-span-3">
            <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-brand-orange hover:text-brand-orange" data-testid="composer-resolve">Work out who that is</button>
            <span className="ml-3 text-xs text-slate-500">{option.whereFrom}</span>
          </div>
        </form>

        {/* The count, before anything is sent, and the names behind it. */}
        <div className={`mt-5 rounded-2xl p-4 ${audience.ok ? "bg-slate-50" : "bg-amber-50"}`} data-testid="composer-audience-summary">
          {audience.ok ? (
            <>
              <p className="text-sm font-black text-slate-950" data-testid="composer-count">{describeAudience(audience)}</p>
              {audience.suppressed.length ? <p className="mt-1 text-xs text-slate-600">{audience.suppressed.length} {audience.suppressed.length === 1 ? "person has" : "people have"} unsubscribed from announcements and will not be mailed. Anything addressed to them personally still reaches them.</p> : null}
              {audience.withoutEmail ? <p className="mt-1 text-xs text-slate-600" data-testid="composer-unreachable">{audience.withoutEmail} {audience.withoutEmail === 1 ? "person in this group has" : "people in this group have"} no address on file, so we cannot reach {audience.withoutEmail === 1 ? "them" : "them"} at all.</p> : null}
              <details className="mt-2" data-testid="composer-expand">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-brand-muted">Show me exactly who</summary>
                <ul className="mt-2 grid gap-1 text-xs text-slate-700">
                  {audience.members.map((member) => <li key={member.personKey} data-testid={`composer-member-${member.personKey}`}>{member.name ? `${member.name} · ` : ""}{member.email} <span className="text-slate-400">({member.source})</span></li>)}
                </ul>
                {audience.suppressed.length ? (
                  <>
                    <p className="mt-3 text-xs font-black uppercase tracking-wide text-brand-muted">Unsubscribed, left out</p>
                    <ul className="mt-1 grid gap-1 text-xs text-slate-500">
                      {audience.suppressed.map((member) => <li key={member.personKey}>{member.email}</li>)}
                    </ul>
                  </>
                ) : null}
              </details>
            </>
          ) : (
            <p className="text-sm font-bold text-amber-900" data-testid="composer-refusal">{audience.reason}</p>
          )}
        </div>

        {/* 3 · Message and 4 · Send. */}
        <form action={sendGroupEmailAction} className="mt-5 grid gap-3" data-testid="composer-send-form">
          <fieldset disabled={!canSend} className="contents">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="audience" value={audienceKind} />
            <input type="hidden" name="oneOff" value={oneOff} />
            {/* What she confirmed. If it is not still true at send time, nothing goes. */}
            <input type="hidden" name="expectedCount" value={String(audience.members.length)} />
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Message
              <select name="workflow" defaultValue={String(query?.workflow || "")} className="rounded-xl border border-slate-300 px-3 py-2" data-testid="composer-workflow">
                <option value="">Write my own</option>
                {MANUAL_WORKFLOWS.map((entry) => <option key={entry.workflow} value={entry.workflow}>{entry.label} — {entry.gist}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Subject
              <input name="subject" placeholder="Leave blank to use the template's own subject" className="rounded-xl border border-slate-300 px-3 py-2" data-testid="composer-subject" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              What it says
              <textarea name="body" rows={6} placeholder="Doors at 9, the stream link is in the invite, bring the deck." className="rounded-xl border border-slate-300 px-3 py-2" data-testid="composer-body" />
              <span className="text-xs font-normal text-slate-500">With a template chosen this is the line of your own inside it. Writing your own needs both a subject and a body.</span>
            </label>
            <div className="rounded-2xl border border-brand-line p-4">
              <p className="text-sm font-black text-slate-950" data-testid="composer-confirm">
                {audience.ok
                  ? `You are about to email ${describeAudience(audience)}. One press, one send, and it cannot be taken back.`
                  : "There is nobody to send this to yet."}
              </p>
              {audienceKind === "one_person" ? (
                <p className="mt-1 text-xs text-slate-600">One person by name is a transactional message: it carries no unsubscribe footer and the unsubscribe list does not apply to it.</p>
              ) : (
                <p className="mt-1 text-xs text-slate-600">This is a group message, so it carries a working unsubscribe link and anybody who has unsubscribed is already out of the count above.</p>
              )}
              {overDaily ? <p className="mt-2 text-xs font-bold text-red-800" data-testid="composer-over-cap">That is more than today&rsquo;s remaining allowance of {volume.dailyRemaining}. Send it tomorrow or to a smaller group — nothing will be half-sent.</p> : null}
              <button className="mt-3 rounded-full bg-brand-black px-5 py-3 text-sm font-black text-white hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-40" data-testid="composer-send">
                {audience.ok ? `Send to ${audience.members.length} ${audience.members.length === 1 ? "person" : "people"}` : "Send"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </SectionCard>
  );
}
