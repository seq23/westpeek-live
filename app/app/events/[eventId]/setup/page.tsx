import { EventSetupShell } from "@/components/events/setup/EventSetupShell";
import { BasicsSetupPanel } from "@/components/events/setup/SetupPanels";
import { EventJoinCodePanel } from "@/components/events/EventJoinCodePanel";
import { updateEventBasicsAction } from "@/lib/actions/eventWorkspaceActions";
import { getEventConfigPackage } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { questionLines, questionsForEvent } from "@/services/attendees/registrationQuestions";

export const dynamic = "force-dynamic";

function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EventSetupPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const runtime = await ensureRuntimeEvent(resolvedParams.eventId);
  const config = getEventConfigPackage(resolvedParams.eventId);
  const editable = runtime && runtime.source !== "seed" ? runtime : undefined;
  return (
    <EventSetupShell eventId={resolvedParams.eventId} active="basics" eyebrow="Setup · Basics" title="Event basics">
      {editable ? (
        <section className="mb-6 space-y-6" data-testid="event-setup-draft-summary">
          <EventJoinCodePanel event={editable} />
          {resolvedSearchParams?.saved ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Basics saved.</p> : null}
          {resolvedSearchParams?.error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Could not save: {resolvedSearchParams.error}</p> : null}
          <form action={updateEventBasicsAction} className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm">
            <input type="hidden" name="eventId" value={editable.id} />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Edit basics</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="setup-name" className="text-sm font-black">Event name</label>
                <input id="setup-name" name="name" defaultValue={editable.name} required maxLength={120} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
              </div>
              <div>
                <label htmlFor="setup-type" className="text-sm font-black">Type</label>
                <input id="setup-type" name="eventType" defaultValue={editable.eventType} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
              </div>
              <div>
                <label htmlFor="setup-start" className="text-sm font-black">Start</label>
                <input id="setup-start" name="startAt" type="datetime-local" defaultValue={toLocalInput(editable.startAt)} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
              </div>
              <div>
                <label htmlFor="setup-timezone" className="text-sm font-black">Timezone</label>
                <input id="setup-timezone" name="timezone" defaultValue={editable.timezone} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 text-sm font-black"><input type="checkbox" name="registrationEnabled" defaultChecked={editable.registrationEnabled} /> Require registration</label>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="setup-questions" className="text-sm font-black">&ldquo;Tell us more&rdquo; questions</label>
                <p className="mt-1 text-xs text-brand-muted">One per line as <code>Label | textarea</code>, <code>Label | text</code>, or <code>Label | tags</code>; up to eight; reorder by moving lines. Attendees see these on the stage and lobby after registering.</p>
                <textarea id="setup-questions" name="registrationQuestions" defaultValue={questionLines(questionsForEvent(editable))} rows={5} className="mt-2 w-full rounded-2xl border border-brand-line px-4 py-3 font-mono text-xs" data-testid="registration-questions-input" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="setup-description" className="text-sm font-black">One line for attendees</label>
                <input id="setup-description" name="description" defaultValue={editable.description || ""} maxLength={240} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
              </div>
            </div>
            <button type="submit" className="mt-5 rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white">Save basics</button>
          </form>
          <div className="rounded-3xl border border-brand-line bg-brand-ash p-5" data-testid="event-scoped-day1-command-links">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Event-scoped command links</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/events/${editable.slug}`}>Public Event Page</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/venue/${editable.id}/lobby`}>Venue Lobby</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/app/events/${editable.id}/run-of-show`}>Run of Show</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/app/events/${editable.id}/crew`}>Crew Briefing &amp; Instructions</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/app/events/${editable.id}/access`}>Role Access &amp; Codes</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/app/events/${editable.id}/approval-queue`}>Producer Approval Queue</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/app/events/${editable.id}/publish`}>Publish</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/app/events/${editable.id}/preview`}>Preview</a>
              <a className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm" href={`/admin/testing/${editable.id}`}>Testing Console</a>
            </div>
          </div>
        </section>
      ) : null}
      <BasicsSetupPanel event={config.event} />
    </EventSetupShell>
  );
}
