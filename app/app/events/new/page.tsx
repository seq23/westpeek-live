import Link from "next/link";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { RuntimeSchemaStop } from "@/components/system/RuntimeSchemaStop";
import { createEventAction } from "@/lib/actions/eventWorkspaceActions";
import { getRuntimeSchemaStatus, listClientRecords } from "@/services/events/eventRepository";
import { questionLines } from "@/services/attendees/registrationQuestions";
import { getEventTemplate } from "@/services/events/eventTemplateService";
import { DEFAULT_REGISTRATION_QUESTIONS } from "@/types/attendeeRegistration";

export const dynamic = "force-dynamic";

const eventTypes = [
  ["webinar", "Webinar"],
  ["virtual_summit", "Virtual summit"],
  ["demo_day", "Demo day"],
  ["sponsor_expo", "Sponsor expo"],
  ["paid_workshop", "Paid workshop"],
  ["executive_roundtable", "Executive roundtable"],
  ["community_event", "Community event"],
  ["course_launch", "Course launch"],
  ["internal_town_hall", "Internal town hall"],
] as const;

function defaultStartLocal() {
  const next = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  next.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:00`;
}

export default async function CreateEventPage({ searchParams }: { searchParams?: Promise<{ when?: string; error?: string; clientId?: string; template?: string }> }) {
  const resolved = searchParams ? await searchParams : undefined;
  const initialWhen = resolved?.when === "later" || resolved?.clientId ? "later" : "now";
  const initialClientId = resolved?.clientId || "";
  // "Use this template" arrives as ?template=…: the form opens already filled in.
  const template = resolved?.template ? await getEventTemplate(resolved.template) : undefined;
  const [schema, clients] = await Promise.all([getRuntimeSchemaStatus(), listClientRecords()]);
  const error = resolved?.error;

  return (
    <main className="min-h-screen bg-brand-ash px-5 py-8 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <WestPeekProductionsLogo size="md" />
          <Link href="/app/events" className="rounded-full border border-brand-line px-4 py-2 text-sm font-bold hover:border-brand-orange hover:text-brand-orange">Back to events</Link>
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">New event</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Start a Room now, or plan an event for later.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted">One form creates every event West Peek Live runs — an on-demand Room for West Peek itself or a planned client event. The event, its join code, and its crew, speaker, sponsor, VIP, and client access codes are saved the moment you press the button. No PR, no redeploy.</p>

        {!schema.ok ? <RuntimeSchemaStop status={schema} /> : null}
        {error === "schema_missing" ? <RuntimeSchemaStop status={schema} /> : null}
        {error && error !== "schema_missing" ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800" role="alert">Could not create the event: {error}</p> : null}

        {template ? (
          <p className="mt-6 rounded-2xl border border-brand-line bg-brand-ash p-4 text-sm" data-testid="create-from-template">
            Starting from <strong>{template.name}</strong> — {template.format === "room" ? "Room" : "Stage"}, {template.durationMinutes} minutes{template.sessions.length ? `, ${template.sessions.length} session${template.sessions.length === 1 ? "" : "s"}` : ""}. Change anything you like; nothing is locked.
          </p>
        ) : null}

        <form action={createEventAction} className="mt-8 space-y-8" data-testid="create-event-form">
          {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
          <fieldset className="rounded-3xl border border-brand-line bg-brand-ash p-5">
            <legend className="px-2 text-sm font-black">When <span className="text-brand-orange">*</span></legend>
            <p className="mt-1 text-xs text-brand-muted">This is the only decision that changes the form. Everything else is defaulted to West Peek branding, one Main stage session, and the LiveKit-first fallback ladder.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-line bg-white p-4 has-[:checked]:border-brand-orange has-[:checked]:ring-2 has-[:checked]:ring-brand-orange/30">
                <input type="radio" name="when" value="now" defaultChecked={initialWhen === "now"} className="mt-1" data-testid="when-now" />
                <span>
                  <span className="block text-sm font-black">Now</span>
                  <span className="mt-1 block text-xs leading-5 text-brand-muted">Create &amp; open. The event goes live immediately with a join code you can send to anyone.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-line bg-white p-4 has-[:checked]:border-brand-orange has-[:checked]:ring-2 has-[:checked]:ring-brand-orange/30">
                <input type="radio" name="when" value="later" defaultChecked={initialWhen === "later"} className="mt-1" data-testid="when-later" />
                <span>
                  <span className="block text-sm font-black">Later</span>
                  <span className="mt-1 block text-xs leading-5 text-brand-muted">Create a draft. Set the client, date, and type; publish from the event page when it is ready.</span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="name" className="text-sm font-black">Event name <span className="text-brand-orange">*</span></label>
              <input id="name" name="name" required maxLength={120} defaultValue={template ? `${template.name} — ` : ""} placeholder="Founder office hours" className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" data-testid="create-event-name" />
            </div>
            <div>
              <label htmlFor="format" className="text-sm font-black">Format</label>
              <p className="mt-1 text-xs text-brand-muted">Stage is one-to-many with a LiveKit main stage. Room is a smaller interactive session.</p>
              <select id="format" name="format" defaultValue={template?.format || "stage"} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm">
                <option value="stage">Stage</option>
                <option value="room">Room</option>
              </select>
            </div>
            <div>
              <label htmlFor="eventType" className="text-sm font-black">Type</label>
              <p className="mt-1 text-xs text-brand-muted">Used for planned client events; Rooms default to community event.</p>
              <select id="eventType" name="eventType" defaultValue={template?.eventType || "webinar"} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm">
                {eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="clientId" className="text-sm font-black">Client</label>
              <p className="mt-1 text-xs text-brand-muted">Leave as West Peek for your own Rooms. Pick an existing client or type a new one below.</p>
              <select id="clientId" name="clientId" defaultValue={initialClientId} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm">
                <option value="">West Peek (own event)</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="clientName" className="text-sm font-black">New client name</label>
              <p className="mt-1 text-xs text-brand-muted">Only used when no existing client is selected. Creates the client too.</p>
              <input id="clientName" name="clientName" maxLength={120} placeholder="Acme Health" className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
            </div>
            <div>
              <label htmlFor="startAt" className="text-sm font-black">Date and time (Later only)</label>
              <p className="mt-1 text-xs text-brand-muted">Ignored when you choose Now — a Room starts the moment it is created.</p>
              <input id="startAt" name="startAt" type="datetime-local" defaultValue={defaultStartLocal()} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
            </div>
            <div>
              <label htmlFor="timezone" className="text-sm font-black">Timezone</label>
              <input id="timezone" name="timezone" defaultValue="America/Chicago" className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="text-sm font-black">One line for attendees (optional)</label>
              <input id="description" name="description" maxLength={240} placeholder="Weekly founder Q&A with the West Peek team." className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
            </div>
            <div>
              <label htmlFor="registrationQuestions" className="text-sm font-black">&ldquo;Tell us more&rdquo; questions (optional, one per line)</label>
              <p className="mt-1 text-xs text-brand-muted">What attendees are asked after they register, on the stage and lobby. One per line as <code>Label | textarea</code>, <code>Label | text</code>, or <code>Label | tags</code>; up to eight; reorder by moving lines.</p>
              <textarea id="registrationQuestions" name="registrationQuestions" defaultValue={questionLines(DEFAULT_REGISTRATION_QUESTIONS)} rows={4} className="mt-2 w-full rounded-2xl border border-brand-line px-4 py-3 font-mono text-xs" data-testid="registration-questions-input" />
            </div>
          </div>

          <div className="rounded-3xl bg-brand-ash p-5 text-sm leading-6 text-brand-muted">
            <p className="font-black text-brand-black">Defaults applied to every event</p>
            <p>Branding: West Peek Live. Agenda: one Main stage session. Registration: off — the join code is enough. Production feed / source: StreamYard. Primary embedded distribution: LiveKit. Fallback: Cloudflare Stream, then Daily, then Zoom + Google Meet.</p>
            <p className="mt-2">Guided spine after creation: Basics → Branding → Attendee Flow → Venue → Agenda → Access → Communications → Preview → Publish.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white hover:bg-brand-orange" data-testid="create-event-submit" disabled={!schema.ok}>
              Create event
            </button>
            <Link href="/app/events" className="inline-flex rounded-full border border-brand-black px-5 py-3 text-sm font-bold">Cancel</Link>
          </div>
          <p className="text-xs text-brand-muted">Now → &ldquo;Create &amp; open&rdquo; lands you in the lobby with the join code. Later → &ldquo;Create&rdquo; opens the draft event page.</p>
        </form>
      </section>
    </main>
  );
}
