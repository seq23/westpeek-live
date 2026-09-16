"use client";
import { archiveEventAction, restoreEventAction } from "@/lib/actions/eventWorkspaceActions";

/**
 * Archive (or restore) an event from the console, using the one archive path the event page uses —
 * which also releases the LiveKit ingress. Archiving is reversible and the confirm says so.
 */
export function EventArchiveControl({ eventId, eventName, archived, returnTo = "/app/owner" }: { eventId: string; eventName: string; archived: boolean; returnTo?: string }) {
  if (archived) {
    return (
      <form action={restoreEventAction} className="inline">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="rounded-full border border-brand-black px-3 py-1 text-xs font-black hover:border-brand-orange hover:text-brand-orange" data-testid={`console-restore-${eventId}`}>Restore</button>
      </form>
    );
  }
  return (
    <form
      action={archiveEventAction}
      className="inline"
      onSubmit={(submit) => { if (!window.confirm(`Archive "${eventName}"? It leaves the working lists and its stage is released. Nothing is deleted — you can restore it from the Archived group.`)) submit.preventDefault(); }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button className="rounded-full border border-brand-line px-3 py-1 text-xs font-black text-brand-muted hover:border-brand-orange hover:text-brand-orange" data-testid={`console-archive-${eventId}`}>Archive</button>
    </form>
  );
}
