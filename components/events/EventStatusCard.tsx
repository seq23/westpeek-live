import { ReadinessScore } from "@/components/shared/ReadinessScore";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { EventPortfolioCard } from "@/services/events/eventPortfolioService";

const readinessKeys = ["accessReadiness", "speakerReadiness", "sponsorReadiness", "assetReadiness", "runOfShowStatus", "videoHealth", "publishStatus", "lastSmokeResult", "reportingStatus", "fallbackRecommendation"] as const;

export function EventStatusCard({ card }: { card: EventPortfolioCard }) {
  const seed = card.source === "seed";
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-orange" data-testid={`event-card-${card.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a href={`/app/events/${card.id}`} className="block text-lg font-black text-slate-950 hover:text-brand-orange">{card.name}</a>
          <p className="text-sm text-slate-500">{card.client} · {new Date(card.startAt).toLocaleString("en-US", { timeZone: card.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {card.timezone}</p>
          <p className="mt-1 text-xs text-slate-500">{seed ? "Demo / seed event (compiled)" : `${card.format === "room" ? "Room" : "Stage"} · join code ${card.joinCode} · ${card.createdByLabel}`}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={card.status} tone={card.status === "live" ? "good" : card.status === "archived" ? "bad" : card.incidentCount > 0 ? "bad" : "neutral"} />
          {seed ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Demo</span> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <a href={`/app/events/${card.id}`} className="rounded-full bg-brand-black px-3 py-2 text-white">Open</a>
        <a href={`/venue/${card.id}/lobby`} className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">Lobby</a>
        {!seed ? <a href={`/app/events/${card.id}/access`} className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">Access codes</a> : null}
      </div>
      <details className="mt-4 rounded-2xl bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">Readiness · {card.readinessScore}%</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ReadinessScore score={card.readinessScore} label="Event readiness" />
          <ReadinessScore score={card.setupCompletion} label="Setup completion" />
        </div>
        <dl className="mt-3 grid gap-2 text-xs md:grid-cols-2">
          {readinessKeys.map((key) => (
            <div key={key} className="rounded-2xl bg-white p-3">
              <dt className="font-bold uppercase tracking-wide text-slate-400">{key.replace(/([A-Z])/g, " $1")}</dt>
              <dd className="mt-1 font-semibold text-slate-800">{String(card[key])}</dd>
            </div>
          ))}
        </dl>
        {card.status === "live" ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <strong>Live now:</strong> {card.currentSegment} · Next: {card.nextSegment}
          </div>
        ) : null}
      </details>
    </article>
  );
}
