import { buildVirtualVenueModel, sortBreakouts } from "@/services/venue";
import { BreakoutRoomCard } from "@/components/venue/BreakoutRoomCard";
import { BreakoutRoomExperience } from "@/components/venue/BreakoutRoomExperience";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { SafeSection } from "@/components/system/SafeSection";
import { VenueEmptyState } from "@/components/venue/VenueEmptyState";

export default async function BreakoutsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  const rooms = sortBreakouts(model.breakouts);
  const activeRoomId = rooms[0]?.id || "general-breakout";
  return (
    <VenuePageShell model={model}>
      <section className="space-y-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Breakouts</p>
          <h2 className="mb-1 mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">Smaller rooms</h2>
          <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-600">A breakout is a small video room running alongside the main show. Camera and mic are yours to turn on.</p>
          {rooms.length ? <div className="grid gap-4 md:grid-cols-3">{rooms.map((room) => <BreakoutRoomCard key={room.id} room={room} />)}</div>
            : <VenueEmptyState title="No breakout rooms at this event." line="Everything today happens on the main stage, with the chat beside it." actionHref={`/venue/${model.eventId}/stage`} actionLabel="Go to the main stage" testId="breakouts-empty" />}
        </div>
        {rooms.length ? <SafeSection label="Breakout room" render={() => BreakoutRoomExperience({ model: model, roomId: activeRoomId })} /> : null}
      </section>
    </VenuePageShell>
  );
}
