import Link from "next/link";
import { listEventTemplates } from "@/services/events/eventTemplateService";
import { templateSummary } from "@/types/eventTemplates";

/**
 * The shelf, on the create form.
 *
 * Templates existed and worked, but /app/events/new never showed them: you had to already be on
 * /app/templates and press "Use this template". From the form itself the feature was invisible, so
 * it read as missing. This is the first thing on the page, above the Now/Later choice, because
 * picking a template changes what the rest of the form is already filled with.
 *
 * With no templates it says so and points at the page that makes one, rather than rendering nothing
 * and leaving a gap where a feature should be.
 */
export async function NewEventTemplatePicker({ selectedId, when, clientId }: { selectedId?: string; when?: string; clientId?: string }) {
  const templates = await listEventTemplates();
  const keep = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    if (when) params.set("when", when);
    if (clientId) params.set("clientId", clientId);
    for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
    const query = params.toString();
    return `/app/events/new${query ? `?${query}` : ""}`;
  };

  if (!templates.length) {
    return (
      <section className="mt-8 rounded-3xl border border-brand-line bg-brand-ash p-5" data-testid="new-event-template-picker" data-count="0">
        <p className="text-sm font-black">Start from a template</p>
        <p className="mt-1 text-sm text-brand-muted">
          There are no templates yet. A template is a shape you run often — the length, the agenda and the registration questions — so the next event like it starts half filled in.{" "}
          <Link href="/app/templates" className="font-black underline hover:text-brand-orange" data-testid="new-event-template-empty-link">Make one on the Templates page</Link>, or save an event you liked as one.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-3xl border border-brand-line bg-brand-ash p-5" data-testid="new-event-template-picker" data-count={templates.length} data-selected={selectedId || ""}>
      <p className="text-sm font-black">Start from a template</p>
      <p className="mt-1 text-xs text-brand-muted">Optional. Picking one fills in the format, the type, the length, the agenda and the registration questions below — you can change any of it.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {templates.map((template) => {
          const selected = template.id === selectedId;
          return (
            <li key={template.id}>
              <Link
                href={selected ? keep({}) : keep({ template: template.id })}
                aria-pressed={selected}
                className={`flex flex-col rounded-2xl border px-4 py-2 text-left ${selected ? "border-brand-orange bg-white ring-2 ring-brand-orange/30" : "border-brand-line bg-white hover:border-brand-orange"}`}
                data-testid={`new-event-template-${template.id}`}
              >
                <span className="text-sm font-black">{template.name}</span>
                <span className="text-[11px] text-brand-muted">{templateSummary(template)}</span>
              </Link>
            </li>
          );
        })}
        {selectedId ? (
          <li>
            <Link href={keep({})} className="inline-flex items-center rounded-2xl border border-brand-line bg-white px-4 py-2 text-xs font-black text-brand-muted hover:border-brand-orange" data-testid="new-event-template-clear">
              Start from scratch instead
            </Link>
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-xs text-brand-muted">
        <Link href="/app/templates" className="font-black underline hover:text-brand-orange">Manage templates</Link> — edit these, delete the ones you do not run, or save an event as a new one.
      </p>
    </section>
  );
}
