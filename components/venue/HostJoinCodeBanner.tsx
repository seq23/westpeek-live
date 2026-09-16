import Link from "next/link";
import { EventJoinCodePanel } from "@/components/events/EventJoinCodePanel";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/** Host-only panel at the top of a runtime event's lobby: the join code, the link, and the way back to the workspace. */
export function HostJoinCodeBanner({ event, justCreated }: { event: RuntimeEventRecord; justCreated?: boolean }) {
  return (
    <section className="space-y-3" data-testid="host-join-code-banner">
      {justCreated ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="event-created-notice">
          {event.status === "live" ? `${event.name} is live. Send the code below to anyone you want in the room.` : `${event.name} is ready. Publish it from the workspace when you want the code to work.`}
        </p>
      ) : null}
      <EventJoinCodePanel event={event} tone="dark" headline={event.status === "live" ? "You are hosting · live now" : `You are hosting · ${event.status.replaceAll("_", " ")}`} />
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/venue/${event.id}/stage`} className="rounded-full bg-brand-black px-4 py-2 font-bold text-white hover:bg-brand-orange">Open the stage</Link>
        <Link href={`/app/events/${event.id}`} className="rounded-full border border-brand-black px-4 py-2 font-bold hover:border-brand-orange hover:text-brand-orange">Event command center</Link>
        <Link href={`/app/events/${event.id}/access`} className="rounded-full border border-brand-black px-4 py-2 font-bold hover:border-brand-orange hover:text-brand-orange">Crew &amp; guest codes</Link>
      </div>
    </section>
  );
}
