import { buildVirtualVenueModel, sortBreakouts } from "@/services/venue";
import { BreakoutRoomCard } from "@/components/venue/BreakoutRoomCard";
import { BreakoutRoomExperience } from "@/components/venue/BreakoutRoomExperience";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

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
          <h2 className="mb-4 text-2xl font-semibold">Breakout rooms</h2>
          <div className="grid gap-4 md:grid-cols-3">{rooms.map((room) => <BreakoutRoomCard key={room.id} room={room} />)}</div>
        </div>
        <BreakoutRoomExperience model={model} roomId={activeRoomId} />
      </section>
    </VenuePageShell>
  );
}
