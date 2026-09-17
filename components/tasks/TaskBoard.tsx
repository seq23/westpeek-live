import { SectionCard } from "@/components/shared/SectionCard";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { TaskBoardSeedView } from "@/components/tasks/TaskBoardSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { getEventWorkspaceReadModel } from "@/services/events/eventWorkspaceReadModel";

/**
 * Tasks and milestones have NO runtime table — nothing in Supabase stores a task the owner typed,
 * and inventing a schema to fill this page is not the job. So a real event gets the truth: there is
 * no task list yet, and here is what is actually outstanding on the event, counted from the rows
 * that DO exist (files waiting for review, cue decks waiting for approval, tech checks not
 * recorded, sponsor booths not published).
 *
 * The demo event keeps its fixture board (TaskBoardSeedView) — that is what a demo is for.
 */
export async function TaskBoard({ eventId }: { eventId: string }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <TaskBoardSeedView eventId={eventId} />;
  const model = await getEventWorkspaceReadModel(event);

  const pendingDecks = model.speakers.filter((speaker) => speaker.cueDeckPending).length;
  const openTechChecks = model.speakers.filter((speaker) => speaker.techCheck !== "ready").length;
  const unpublishedBooths = model.sponsors.filter((sponsor) => !sponsor.booth?.published).length;
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const outstanding = [
    { id: "assets", count: model.assetsInReview, label: `${plural(model.assetsInReview, "file", "files")} waiting for review`, href: `/app/events/${event.id}/assets`, action: "Open assets" },
    { id: "cue-decks", count: pendingDecks, label: `${plural(pendingDecks, "cue deck", "cue decks")} waiting for your approval`, href: `/app/events/${event.id}`, action: "Open the crew deck" },
    { id: "tech-checks", count: openTechChecks, label: `${plural(openTechChecks, "speaker tech check", "speaker tech checks")} not recorded`, href: `/app/events/${event.id}/speakers`, action: "Open speakers" },
    { id: "booths", count: unpublishedBooths, label: `${plural(unpublishedBooths, "sponsor booth", "sponsor booths")} not published`, href: `/app/events/${event.id}/sponsors`, action: "Open sponsors" },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-6" data-testid="task-board" data-outstanding={outstanding.length}>
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Tasks and milestones</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
      </div>
      <WorkspaceEmptyState
        testId="tasks-empty"
        title="There is no task list for a real event yet"
        line="Nothing in the store keeps a task or a milestone you typed, so this page will not pretend to. What it can tell you truthfully is below: everything the event is actually waiting on, counted from its own rows. A real task board needs a runtime table and an owner per row; until it exists, the crew deck and the approval queue are where work is tracked."
        actionHref={`/app/events/${event.id}/approval-queue`}
        actionLabel="Open the approval queue"
      />
      <SectionCard title="What this event is waiting on" eyebrow={outstanding.length ? `${outstanding.length} open` : "nothing open"}>
        {outstanding.length ? (
          <ul className="space-y-2" data-testid="task-outstanding">
            {outstanding.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4" data-testid={`task-outstanding-${item.id}`}>
                <p className="font-bold text-slate-900">{item.label}</p>
                <a href={item.href} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-800">{item.action}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600" data-testid="task-outstanding-clear">Nothing is waiting: no file in review, every cue deck approved, every tech check recorded, every booth published.</p>
        )}
      </SectionCard>
    </div>
  );
}
