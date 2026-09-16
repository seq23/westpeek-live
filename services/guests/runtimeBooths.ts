import { listSponsorBooths } from "@/services/guests/guestStateService";
import type { VirtualVenueBooth, VirtualVenueModel } from "@/types/virtualVenue";

/** Booths that sponsors set up themselves for this event, in the same shape as the seed booths. */
export async function listRuntimeVenueBooths(eventId: string): Promise<VirtualVenueBooth[]> {
  const booths = await listSponsorBooths(eventId);
  return booths.map(({ guestId, state }) => ({ id: guestId as string, name: state.boothName, headline: state.blurb ? state.blurb.slice(0, 140) : state.boothName, description: state.blurb || state.boothName, href: `/venue/${eventId}/expo/${guestId}`, ctaLabel: state.link ? "Visit booth" : "Visit booth" }));
}

/** The venue model with runtime sponsor booths appended (seed booths stay first). */
export async function withRuntimeBooths(model: VirtualVenueModel): Promise<VirtualVenueModel> {
  const runtime = await listRuntimeVenueBooths(model.eventId).catch(() => [] as VirtualVenueBooth[]);
  if (!runtime.length) return model;
  const known = new Set(model.booths.map((booth) => booth.id));
  return { ...model, booths: [...model.booths, ...runtime.filter((booth) => !known.has(booth.id))] };
}
