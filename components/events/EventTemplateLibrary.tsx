import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { deleteTemplateAction, saveEventAsTemplateAction, saveTemplateAction } from "@/lib/actions/eventTemplateActions";
import { listEventTemplates } from "@/services/events/eventTemplateService";
import { listEventRecords } from "@/services/events/eventRepository";
import { templatePrefillQuery, templateSummary } from "@/types/eventTemplates";

/**
 * Templates, wired. They used to be three compiled fixtures rendered as read-only cards that
 * nothing consumed — /app/events/new never offered one. A template is now a real row you make from
 * an event that worked, and "Use this template" opens the create form already filled in.
 */
export async function EventTemplateLibrary({ saved, error, deleted }: { saved?: string; error?: string; deleted?: string } = {}) {
  const [templates, events] = await Promise.all([
    listEventTemplates(),
    listEventRecords({ includeSeed: false }).catch(() => []),
  ]);
  return (
    <SectionCard title="Event templates" eyebrow={`${templates.length} template${templates.length === 1 ? "" : "s"}`}>
      <div data-testid="event-templates" data-count={templates.length}>
        <p className="text-sm text-brand-muted">
          A template is a starting point for an event: the format, the type, how long it runs, the sessions it opens with and the questions it asks at registration. Press <strong>Use this template</strong> and the New event form opens already filled in — you change the name and the date and you are done.
        </p>
        {saved ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="template-saved">Saved &ldquo;{saved}&rdquo;.</p> : null}
        {deleted ? <p className="mt-3 rounded-2xl bg-brand-ash p-3 text-sm font-bold" data-testid="template-deleted">Template deleted.</p> : null}
        {error ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900" data-testid="template-error">{error}</p> : null}

        {templates.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {templates.map((template) => (
              <li key={template.id} className="rounded-2xl border border-brand-line p-4" data-testid={`template-${template.id}`}>
                <p className="font-black text-brand-black">{template.name}</p>
                <p className="text-xs text-brand-muted">{templateSummary(template)} · {template.eventType.replaceAll("_", " ")}</p>
                {template.description ? <p className="mt-2 text-sm text-brand-muted">{template.description}</p> : null}
                {template.sessions.length ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-brand-muted">
                    {template.sessions.slice(0, 5).map((session, index) => <li key={index}>{session.title} · {session.minutes} min</li>)}
                    {template.sessions.length > 5 ? <li>…and {template.sessions.length - 5} more.</li> : null}
                  </ul>
                ) : null}
                <p className="mt-2 text-[11px] text-brand-muted">Saved by {template.createdByLabel || "someone"} · <LocalTime iso={template.updatedAt} mode="datetime" /></p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/app/events/new${templatePrefillQuery(template)}`} className="rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white hover:bg-brand-orange" data-testid={`use-template-${template.id}`}>Use this template</Link>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <button className="rounded-full border border-brand-line px-3 py-2 text-xs font-black text-brand-muted" data-testid={`delete-template-${template.id}`}>Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4"><EmptyState title="No templates yet" body="Save one from an event that worked — below — and the next event like it starts from there instead of from scratch." /></div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form action={saveEventAsTemplateAction} className="rounded-2xl border border-brand-line p-4" data-testid="save-event-as-template">
            <p className="font-black">Save an event as a template</p>
            <p className="mt-1 text-xs text-brand-muted">Takes that event&rsquo;s format, type, length, sessions and registration questions. The event itself is untouched.</p>
            <select name="eventId" className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="template-event-select">
              {events.length ? events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>) : <option value="">No events yet</option>}
            </select>
            <input name="name" placeholder="Name this template" className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="template-from-event-name" />
            <button className="mt-3 rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white" data-testid="save-event-as-template-submit">Save it as a template</button>
          </form>

          <form action={saveTemplateAction} className="rounded-2xl border border-brand-line p-4" data-testid="save-template-by-hand">
            <p className="font-black">Or write one</p>
            <p className="mt-1 text-xs text-brand-muted">One session per line: <code className="rounded bg-brand-ash px-1">Title | minutes</code>.</p>
            <input name="name" placeholder="Template name" className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="template-name" />
            <input name="description" placeholder="When would you reach for this?" className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="template-description" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <select name="format" className="rounded-xl border border-brand-line px-2 py-2 text-sm" data-testid="template-format"><option value="stage">Stage</option><option value="room">Room</option></select>
              <input name="eventType" defaultValue="webinar" className="rounded-xl border border-brand-line px-2 py-2 text-sm" data-testid="template-type" />
              <input name="durationMinutes" defaultValue="60" inputMode="numeric" className="rounded-xl border border-brand-line px-2 py-2 text-sm" data-testid="template-duration" />
            </div>
            <textarea name="sessions" placeholder={"Welcome | 10\nMain talk | 35\nQ&A | 15"} className="mt-2 min-h-20 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="template-sessions" />
            <button className="mt-3 rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white" data-testid="save-template-submit">Save the template</button>
          </form>
        </div>
      </div>
    </SectionCard>
  );
}
