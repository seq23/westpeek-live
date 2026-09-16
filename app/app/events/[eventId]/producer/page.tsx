import { redirect } from "next/navigation";

/**
 * One page, one address. /producer rendered exactly what the event's own page renders, so it
 * redirects there now; the link kept working for anyone who had it (16 Sep 2026).
 */
export default async function RedirectedEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/app/events/${eventId}`);
}
