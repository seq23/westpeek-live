import { redirect } from "next/navigation";

/** The venue's root is the lobby: a event code or id typed without a page lands there, never on a 404. */
export default async function VenueRootPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/venue/${eventId}/lobby`);
}
