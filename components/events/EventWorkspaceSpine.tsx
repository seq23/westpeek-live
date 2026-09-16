import { EVENT_SPINE, spineHref, type SpineEntry } from "@/lib/navigation/eventWorkspaceSpine";
import { EventSpineNav, type SpineNavGroup } from "@/components/events/EventSpineNav";
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

function navGroups(eventId: string, state: Readiness): SpineNavGroup[] {
  return EVENT_SPINE.map((group) => ({
    id: group.id,
    title: group.title,
    entries: group.entries.map((entry) => {
      const measured = entry.readiness ? state[entry.readiness] : undefined;
      return {
        href: spineHref(eventId, entry.path),
        label: entry.label,
        title: measured ? `${entry.blurb} — ${measured.detail}` : entry.blurb,
        ready: measured?.ready,
      };
    }),
  }));
}

export async function EventWorkspaceSpine({ eventId }: { eventId: string }) {
  const state = await readiness(eventId);
  return (
    <aside className="lg:w-64 lg:shrink-0">
      {/* The column is taller than a laptop screen: it scrolls inside itself, with "What's next"
          pinned at the top so it stays readable while the groups move under it (16 Sep 2026). */}
      <div className="hidden lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:flex-col lg:rounded-3xl lg:border lg:border-brand-line lg:bg-white" data-testid="event-spine-column">
        <div className="shrink-0 p-4 pb-2"><NextStep state={state} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-2" data-testid="event-spine-scroll">
          <EventSpineNav groups={navGroups(eventId, state)} />
        </div>
      </div>
      <details className="rounded-3xl border border-brand-line bg-white p-3 lg:hidden" data-testid="spine-drawer">
        <summary className="cursor-pointer text-sm font-black">All event pages</summary>
        <div className="mt-3 space-y-3">
          <NextStep state={state} />
          <EventSpineNav groups={navGroups(eventId, state)} />
        </div>
      </details>
    </aside>
  );
}
