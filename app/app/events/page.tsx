import { EventPortfolio, type EventPortfolioSearch } from "@/components/events/EventPortfolio";

export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams?: Promise<EventPortfolioSearch> }) {
  const search = searchParams ? await searchParams : {};
  return <EventPortfolio search={search} />;
}
