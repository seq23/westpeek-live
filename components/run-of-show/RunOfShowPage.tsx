import { getEvent, getRunOfShowForEvent, getSpeakersForEvent, getSponsorsForEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatEventDate } from "@/lib/utils/format";

export function RunOfShowPage({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const segments = getRunOfShowForEvent(event.id);
  const speakers = getSpeakersForEvent(event.id);
  const sponsors = getSponsorsForEvent(event.id);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Run of show</p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
        <p className="mt-2 text-slate-600">Structured production timeline connected to speakers, sponsors, cues, assets, approvals, and crew.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <SectionCard title="Production timeline">
          <div className="space-y-4">
            {segments.map((segment) => {
              const speaker = speakers.find((item) => item.id === segment.speakerId);
              const sponsor = sponsors.find((item) => item.id === segment.sponsorId);
              return (
                <div key={segment.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">{formatEventDate(segment.startAt, event.timezone)} · {segment.durationMinutes} min · {segment.room}</p>
                      <h3 className="mt-1 text-lg font-semibold">{segment.publicTitle}</h3>
                      <p className="mt-1 text-sm text-slate-600">{segment.clientFacingDescription}</p>
                    </div>
                    <StatusBadge status={segment.readinessStatus} tone={segment.readinessStatus === "ready" ? "good" : "warn"} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>Speaker</strong><br />{speaker?.name ?? "None"}</div>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>Sponsor</strong><br />{sponsor?.name ?? "None"}</div>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>Approval</strong><br />{segment.approvalStatus}</div>
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-950 p-3 text-sm text-white">
                    <strong>Producer cue:</strong> {segment.producerNotes}<br />
                    <strong>Technical cue:</strong> {segment.technicalCues}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Readiness panel">
          <div className="space-y-3 text-sm">
            {segments.map((segment) => (
              <div key={segment.id} className="rounded-xl bg-slate-50 p-3">
                <p className="font-medium">{segment.publicTitle}</p>
                <p className="text-slate-500">{segment.readinessStatus} · {segment.approvalStatus}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
