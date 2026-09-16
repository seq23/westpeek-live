import type { EventPortfolioCard } from "@/services/events/eventPortfolioService";

export function EventRiskPanel({ cards }: { cards: EventPortfolioCard[] }) {
  const atRisk = cards.filter((card) => card.status !== "archived" && (card.readinessScore < 80 || card.incidentCount > 0 || card.accessReadiness !== "ready"));
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Risk queue</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">Events at risk</h2>
      {atRisk.length === 0 ? <p className="mt-3 text-sm text-slate-500">No readiness, access, or active incident risks detected.</p> : <ul className="mt-3 space-y-2 text-sm text-slate-700">{atRisk.map((card) => <li key={card.id} className="rounded-2xl bg-amber-50 p-3"><strong>{card.name}</strong>: readiness {card.readinessScore}%, access {card.accessReadiness}, incidents {card.incidentCount}</li>)}</ul>}
    </section>
  );
}
