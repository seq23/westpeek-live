import { EventJoinCodePanel } from "@/components/events/EventJoinCodePanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EnterTheRoomMenu } from "@/components/preview/EnterTheRoomMenu";
import { SafeSection } from "@/components/system/SafeSection";
import { archiveEventAction, publishEventAction, restoreEventAction } from "@/lib/actions/eventWorkspaceActions";
import { formatEventDate } from "@/lib/utils/format";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * The real-row header for a runtime-created event: status, join code, publish /
 * go-live, and archive / restore. Seed events never render this — they are
 * compiled and cannot be changed from the workspace.
 */
export function RuntimeEventHeader({ event, justCreated, error, returnTo }: { event: RuntimeEventRecord; justCreated?: boolean; error?: string; returnTo: string }) {
  const archived = event.status === "archived";
  return (
    <section className="space-y-4" data-testid="runtime-event-header">
      {justCreated ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="event-created-notice">{event.name} was created as a draft. Work through the setup spine below, then publish it from the Publish tab.</p> : null}
      {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{error === "schema_missing" ? "The runtime tables are missing in Supabase; see /app/events/new for the named stop." : error}</p> : null}
      <div className="flex flex-col gap-3 rounded-3xl border border-brand-line bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight">{event.name}</h2>
            <StatusBadge status={event.status} tone={event.status === "live" ? "good" : archived ? "bad" : "neutral"} />
          </div>
          <p className="mt-1 text-sm text-brand-muted">{event.clientName} · {event.format === "room" ? "Room" : "Stage"} · created by {event.createdByLabel}</p>
          <p className="mt-1 text-sm text-brand-muted" data-testid="runtime-event-start">Starts {formatEventDate(event.startAt, event.timezone)} · {event.timezone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!archived && event.status === "draft" ? (
            <form action={publishEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="registration_open" />
              <button type="submit" className="rounded-full bg-brand-black px-4 py-2 text-sm font-bold text-white hover:bg-brand-orange" data-testid="publish-event">Publish</button>
            </form>
          ) : null}
          {!archived && event.status !== "live" && event.status !== "ended" ? (
            <form action={publishEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="live" />
              <button type="submit" className="rounded-full border border-brand-black px-4 py-2 text-sm font-bold hover:border-brand-orange hover:text-brand-orange" data-testid="go-live-event">Go live</button>
            </form>
          ) : null}
          {!archived && event.status === "live" ? (
            <form action={publishEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="ended" />
              <button type="submit" className="rounded-full border border-brand-black px-4 py-2 text-sm font-bold hover:border-brand-orange hover:text-brand-orange" data-testid="end-event">End event</button>
            </form>
          ) : null}
          {archived ? (
            <form action={restoreEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="rounded-full bg-brand-black px-4 py-2 text-sm font-bold text-white" data-testid="restore-event">Restore</button>
            </form>
          ) : (
            <form action={archiveEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="returnTo" value="/app/events" />
              <button type="submit" className="rounded-full border border-brand-line px-4 py-2 text-sm font-bold text-brand-muted hover:border-red-300 hover:text-red-700" data-testid="archive-event">Archive</button>
            </form>
          )}
          {/* "Myself (host)" is the default here: the owner cookie already authorises /venue/**,
              there was simply never a link, so checking your own room meant typing the URL. */}
          <SafeSection label="Enter the room" compact render={() => EnterTheRoomMenu({ eventId: event.id, clientSlug: event.clientSlug, returnTo: returnTo })} />
        </div>
      </div>
      {!archived ? <EventJoinCodePanel event={event} /> : null}
    </section>
  );
}
