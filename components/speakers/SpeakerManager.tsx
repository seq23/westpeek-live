import { getEvent, getSpeakersForEvent } from "@/lib/runtime/getRuntimeData";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ComposeLink } from "@/components/email/ComposeLink";

export function SpeakerManager({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const speakers = getSpeakersForEvent(event.id);

  return (
    <SectionCard title={`${event.name} speakers`} eyebrow="Readiness">
      {/* Straight to the composer with this event and the speakers already picked. */}
      <p className="mb-4"><ComposeLink eventId={eventId} audience="speakers" label="Email speakers" /></p>
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

export function SpeakerPortalDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-sm text-slate-500">Speaker portal</p>
        <h1 className="mt-2 text-3xl font-semibold">Your onboarding checklist</h1>
        <p className="mt-2 text-slate-600">Submit bio, headshot, deck, release, and tech check availability.</p>
      </div>
      <SectionCard title="Required items">
        <div className="grid gap-3 md:grid-cols-2">
          {["Bio submitted", "Headshot submitted", "Deck submitted", "Release signed", "Tech check scheduled", "Backstage link ready"].map((item, index) => (
            <div key={item} className="rounded-xl bg-slate-50 p-3 text-sm">
              <StatusBadge status={index < 3 ? "complete" : "pending"} tone={index < 3 ? "good" : "warn"} /> <span className="ml-2">{item}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
