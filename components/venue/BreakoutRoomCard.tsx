import type { VirtualVenueBreakout } from "@/types/virtualVenue";
import { getBreakoutAvailability } from "@/services/venue";

export function BreakoutRoomCard({ room }: { room: VirtualVenueBreakout }) {
  const availability = getBreakoutAvailability(room);

  return (
    <a href={room.href} className="block rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-slate-300">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{room.status}</p>
      <h3 className="mt-2 text-lg font-semibold">{room.title}</h3>
      <p className="mt-2 text-sm text-slate-600">{room.description}</p>
      <p className="mt-3 text-sm text-slate-500">Host: {room.hostName}</p>
      <p className="mt-1 text-sm font-semibold">{availability.label}</p>
    </a>
  );
}
