import { EventSetupShell } from "@/components/events/setup/EventSetupShell";
import { AccessSetupPanel } from "@/components/events/setup/SetupPanels";
import { EventAccessCodesPanel } from "@/components/events/EventAccessCodesPanel";
import { GuestPreviewList } from "@/components/guests/GuestPreviewLinks";
import { HostPanel } from "@/components/events/HostPanel";
import { getEventAccessConfig, getEventConfigPackage } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function EventSetupSubroutePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  const runtime = await ensureRuntimeEvent(resolvedParams.eventId);
  const config = getEventConfigPackage(resolvedParams.eventId);
  const access = getEventAccessConfig(config.event.slug);
  if (!access) throw new Error(`Access config missing for ${config.event.slug}.`);
  return (
    <EventSetupShell eventId={resolvedParams.eventId} active="access" eyebrow="Setup · Access" title="Access setup">
      {runtime && runtime.source !== "seed" ? (
        <div className="mb-6 space-y-6"><HostPanel eventId={runtime.id} /><EventAccessCodesPanel event={runtime} /></div>
      ) : (
        <p className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">This is a compiled demo/seed event. Its crew password and role codes are Cloudflare secrets named by the env keys below; they are never shown here.</p>
      )}
      <AccessSetupPanel crewKey={access.crewPasswordEnvKey} roles={access.specialGuestCodes} />
      <section className="mt-6 rounded-3xl border border-brand-line bg-white p-5 shadow-sm" data-testid="access-guest-preview">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">See what each guest sees</p>
        <h2 className="mt-2 text-xl font-black">Open a guest&rsquo;s real page as them</h2>
        <p className="mt-2 text-sm text-brand-muted">Their green room, teleprompter, booth, lounge, or overview, with their real state, read-mostly. A banner tells you whose view it is; they never see it.</p>
        <div className="mt-4"><GuestPreviewList eventId={resolvedParams.eventId} clientSlug={config.event.clientSlug} /></div>
      </section>
    </EventSetupShell>
  );
}
