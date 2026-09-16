import Link from "next/link";
import { EventPortfolioTabs } from "@/components/events/EventPortfolioTabs";
import { EventReadinessSummary } from "@/components/events/EventReadinessSummary";
import { EventRiskPanel } from "@/components/events/EventRiskPanel";
import { RuntimeSchemaStop } from "@/components/system/RuntimeSchemaStop";
import { getRuntimeSchemaStatus } from "@/services/events/eventRepository";
import { getEventPortfolioCards } from "@/services/events/eventPortfolioService";

export interface EventPortfolioSearch {
  showDemo?: string;
  showArchived?: string;
  archived?: string;
  restored?: string;
  error?: string;
}

function toggleHref(search: EventPortfolioSearch, key: "showDemo" | "showArchived") {
  const params = new URLSearchParams();
  const next = { ...search, [key]: search[key] === "1" ? undefined : "1" };
  if (next.showDemo === "1") params.set("showDemo", "1");
  if (next.showArchived === "1") params.set("showArchived", "1");
  const query = params.toString();
  return query ? `/app/events?${query}` : "/app/events";
}

export async function EventPortfolio({ search = {} }: { search?: EventPortfolioSearch }) {
  const includeSeed = search.showDemo === "1";
  const includeArchived = search.showArchived === "1";
  const [schema, cards] = await Promise.all([getRuntimeSchemaStatus(), getEventPortfolioCards({ includeSeed, includeArchived })]);
  const realCount = cards.filter((card) => card.source !== "seed").length;
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-brand-line bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between" data-testid="events-header">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Events</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{realCount === 0 ? "No events yet." : `${realCount} event${realCount === 1 ? "" : "s"}`}</h1>
          <p className="mt-1 text-sm text-brand-muted">Every event West Peek Live runs — on-demand Rooms and planned client events — is created from one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={toggleHref(search, "showDemo")} className={`rounded-full border px-4 py-2 text-xs font-bold ${includeSeed ? "border-brand-orange text-brand-orange" : "border-brand-line text-brand-muted"}`} data-testid="toggle-demo-events">{includeSeed ? "Hide demo events" : "Show demo events"}</Link>
          <Link href={toggleHref(search, "showArchived")} className={`rounded-full border px-4 py-2 text-xs font-bold ${includeArchived ? "border-brand-orange text-brand-orange" : "border-brand-line text-brand-muted"}`} data-testid="toggle-archived-events">{includeArchived ? "Hide archived" : "Show archived"}</Link>
          <Link href="/app/events/new" className="rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange" data-testid="new-event-button">New event</Link>
        </div>
      </section>
      {!schema.ok ? <RuntimeSchemaStop status={schema} /> : null}
      {search.archived ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="event-archived-notice">Archived {search.archived}. It is hidden from lists and /join until you restore it.</p> : null}
      {search.restored ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="event-restored-notice">Restored {search.restored}.</p> : null}
      {search.error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{search.error}</p> : null}
      <EventReadinessSummary cards={cards} />
      <EventRiskPanel cards={cards} />
      <EventPortfolioTabs cards={cards} />
    </div>
  );
}
