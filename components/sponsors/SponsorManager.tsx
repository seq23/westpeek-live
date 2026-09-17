import { getEvent, getSponsorBoothsForEvent, getSponsorsForEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ComposeLink } from "@/components/email/ComposeLink";

export function SponsorManager({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const sponsors = getSponsorsForEvent(event.id);
  const booths = getSponsorBoothsForEvent(event.id);

  return (
    <SectionCard title={`${event.name} sponsors`} eyebrow="Expo readiness">
      {/* Straight to the composer with this event and the sponsors already picked. */}
      <p className="mb-4"><ComposeLink eventId={eventId} audience="sponsors" label="Email sponsors" /></p>
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

export function SponsorPortalDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm text-slate-500">Sponsor portal</p>
        <h1 className="mt-2 text-3xl font-semibold">Booth setup and lead report</h1>
        <p className="mt-2 text-slate-600">Manage booth copy, CTA, resources, representatives, and sponsor reporting.</p>
      </div>
      <SectionCard title="Booth deliverables">
        <div className="grid gap-3 md:grid-cols-2">
          {["Logo", "Booth description", "CTA", "Offer", "PDF resource", "Representatives", "Lead routing email"].map((item, index) => (
            <div key={item} className="rounded-xl bg-slate-50 p-3 text-sm">
              <StatusBadge status={index < 4 ? "submitted" : "needed"} tone={index < 4 ? "good" : "warn"} /> <span className="ml-2">{item}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
