import type { VirtualVenueBooth } from "@/types/virtualVenue";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { LiveKitVideoSurface } from "./LiveKitVideoSurface";
import { SponsorLeadCaptureForm } from "./SponsorLeadCaptureForm";
import { SafeSection } from "@/components/system/SafeSection";

export function SponsorBoothExperience({ eventId, booth }: { eventId: string; booth: VirtualVenueBooth }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <AnalyticsBeacon eventId={eventId} kind="attendee_visited_sponsor_booth" subjectId={booth.id} />
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <LiveKitVideoSurface label={`${booth.name} booth`} />
        <h2 className="mt-5 text-2xl font-semibold">{booth.name}</h2>
        <p className="mt-2 text-slate-600">{booth.description}</p>
      </section>
      <SafeSection label="Lead capture" render={() => SponsorLeadCaptureForm({ eventId: eventId, boothId: booth.id })} />
    </div>
  );
}
