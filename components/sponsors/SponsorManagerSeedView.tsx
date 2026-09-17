import { getEvent, getSponsorBoothsForEvent, getSponsorsForEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";

/**
 * @seed-view — the demo/seed branch of the sponsors page, reached ONLY when the event is a seed
 * event, whose fixtures are what a demo is for. A real runtime event goes to SponsorManager's
 * runtime branch instead.
 */
export function SponsorManagerSeedView({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const sponsors = getSponsorsForEvent(event.id);
  const booths = getSponsorBoothsForEvent(event.id);

  return (
    <SectionCard title={`${event.name} sponsors`} eyebrow="Expo readiness · demo event">
      <div className="grid gap-4 md:grid-cols-2">
        {sponsors.map((sponsor) => {
          const booth = booths.find((item) => item.sponsorId === sponsor.id);
          return (
            <div key={sponsor.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{sponsor.name}</p>
                  <p className="text-sm text-slate-500">{sponsor.tier} sponsor · {sponsor.primaryContactName}</p>
                </div>
                <StatusBadge status={sponsor.status} tone={sponsor.status === "live" ? "good" : "warn"} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{booth?.description}</p>
              <div className="mt-3 flex gap-2">
                <StatusBadge status={booth?.approvalStatus ?? "draft"} />
                <StatusBadge status={`${booth?.leadCount ?? 0} leads`} tone="good" />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
