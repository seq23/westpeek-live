import Link from "next/link";
import { EVENT_SPINE, spineHref, type SpineEntry } from "@/lib/navigation/eventWorkspaceSpine";
import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

/**
 * The left spine of an event workspace: every page this event has, grouped the way the work
 * happens, with a readiness dot ONLY where the store can really answer (speakers named, sessions
 * planned, published). Above it, one "What's next" line that names the next real thing to do.
 * On a phone the whole thing collapses into one drawer.
 */
type Readiness = Record<NonNullable<SpineEntry["readiness"]>, { ready: boolean; detail: string }>;

async function readiness(eventId: string): Promise<Readiness> {
  const event = await ensureRuntimeEvent(eventId).catch(() => undefined);
  const speakers = await listGuestProfiles(eventId, "speaker").catch(() => []);
  const sessions = event?.sessions?.length || 0;
  const published = Boolean(event && ["published", "registration_open", "pre_event", "live", "ended", "replay_available"].includes(event.status));
  return {
    speakers: { ready: speakers.length > 0, detail: speakers.length ? `${speakers.length} named` : "nobody named yet" },
    "run-of-show": { ready: sessions > 0, detail: sessions ? `${sessions} session${sessions === 1 ? "" : "s"}` : "no sessions yet" },
    publish: { ready: published, detail: published ? "public page is live" : "not published yet" },
  };
}

function Dot({ ready }: { ready: boolean }) {
  return <span aria-hidden="true" className={`ml-2 inline-block h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`} />;
}

function NextStep({ state }: { state: Readiness }) {
  const next = !state.speakers.ready
    ? "Name the speakers — their green room, cue cards and tech check all hang off that."
    : !state["run-of-show"].ready
      ? "Put the sessions in: the run of show is what the crew calls the show from."
      : !state.publish.ready
        ? "Publish it when you are ready for people to register."
        : "Everything measured is ready. Show day: open the crew console.";
  return (
    <p className="rounded-2xl bg-brand-ash p-3 text-xs font-bold text-brand-black" data-testid="spine-whats-next">
      What&rsquo;s next: {next}
    </p>
  );
}

function Groups({ eventId, state }: { eventId: string; state: Readiness }) {
  return (
    <nav aria-label="Event pages" className="space-y-4" data-testid="event-spine">
      {EVENT_SPINE.map((group) => (
        <div key={group.id} data-testid={`spine-group-${group.id}`}>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-muted">{group.title}</p>
          <ul className="mt-1 space-y-0.5">
            {group.entries.map((entry) => {
              const measured = entry.readiness ? state[entry.readiness] : undefined;
              return (
                <li key={entry.path || "root"}>
                  <Link
                    href={spineHref(eventId, entry.path)}
                    title={measured ? `${entry.blurb} — ${measured.detail}` : entry.blurb}
                    className="flex items-center rounded-xl px-2 py-1.5 text-sm font-bold text-brand-black hover:bg-brand-ash hover:text-brand-orange"
                    data-testid={`spine-link-${entry.path || "root"}`}
                    data-ready={measured ? (measured.ready ? "true" : "false") : undefined}
                  >
                    {entry.label}
                    {measured ? <Dot ready={measured.ready} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export async function EventWorkspaceSpine({ eventId }: { eventId: string }) {
  const state = await readiness(eventId);
  return (
    <aside className="lg:w-64 lg:shrink-0">
      <div className="hidden lg:block lg:sticky lg:top-4 lg:space-y-3 lg:rounded-3xl lg:border lg:border-brand-line lg:bg-white lg:p-4">
        <NextStep state={state} />
        <Groups eventId={eventId} state={state} />
      </div>
      <details className="rounded-3xl border border-brand-line bg-white p-3 lg:hidden" data-testid="spine-drawer">
        <summary className="cursor-pointer text-sm font-black">All event pages</summary>
        <div className="mt-3 space-y-3">
          <NextStep state={state} />
          <Groups eventId={eventId} state={state} />
        </div>
      </details>
    </aside>
  );
}
