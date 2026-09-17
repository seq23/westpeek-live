import { getEvent, getSpeakersForEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";

/**
 * @seed-view — the demo/seed branch of the speakers page, reached ONLY when the event is a seed
 * event. Seed data is fine if it is for a test or a demo, and a seeded training event showing its
 * own fixtures is the point of it. A real runtime event never reaches this file; SpeakerManager
 * sends it to the runtime roster instead.
 */
export function SpeakerManagerSeedView({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const speakers = getSpeakersForEvent(event.id);

  return (
    <SectionCard title={`${event.name} speakers`} eyebrow="Readiness · demo event">
      <div className="grid gap-4 md:grid-cols-2">
        {speakers.map((speaker) => (
          <div key={speaker.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{speaker.name}</p>
                <p className="text-sm text-slate-500">{speaker.title}, {speaker.company}</p>
              </div>
              <StatusBadge status={speaker.readinessStatus} tone={speaker.readinessStatus === "ready" ? "good" : "warn"} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{speaker.sessionTitle}</p>
            <p className="mt-2 text-sm text-slate-500">Tech check: {speaker.techCheckStatus}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
