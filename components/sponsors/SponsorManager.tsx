import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ComposeLink } from "@/components/email/ComposeLink";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { SponsorManagerSeedView } from "@/components/sponsors/SponsorManagerSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { listWorkspaceSponsors } from "@/services/events/eventWorkspaceReadModel";

/**
 * The event's real sponsors: the people who entered with the sponsor code, and the booth each one
 * has written for the expo. A sponsor with no published booth has nothing for an attendee to walk
 * into yet, and the row says so. Until 16 Sep 2026 every event showed the demo summit's sponsors.
 */
export async function SponsorManager({ eventId }: { eventId: string }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <SponsorManagerSeedView eventId={eventId} />;
  const sponsors = await listWorkspaceSponsors(event.id);
  const published = sponsors.filter((sponsor) => sponsor.booth?.published).length;

  return (
    <SectionCard title={`${event.name} sponsors`} eyebrow={`${sponsors.length} sponsor${sponsors.length === 1 ? "" : "s"} · ${published} booth${published === 1 ? "" : "s"} published`}>
      <div data-testid="sponsor-manager" data-count={sponsors.length}>
        {/* Straight to the composer with this event and the sponsors already picked. */}
        {sponsors.length ? <p className="mb-4"><ComposeLink eventId={event.id} audience="sponsors" label="Email sponsors" /></p> : null}
        {sponsors.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {sponsors.map((sponsor) => (
              <div key={sponsor.guestId} className="rounded-2xl border border-slate-200 p-4" data-testid={`sponsor-row-${sponsor.guestId}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{sponsor.booth?.boothName || sponsor.company || sponsor.name}</p>
                    <p className="text-sm text-slate-500">{[sponsor.name, sponsor.title].filter(Boolean).join(" · ")}</p>
                  </div>
                  <StatusBadge status={sponsor.booth?.published ? "booth live" : "no booth yet"} tone={sponsor.booth?.published ? "good" : "warn"} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{sponsor.booth?.blurb || "This sponsor has not written their booth copy yet. They write it themselves from the sponsor portal."}</p>
                {sponsor.booth?.link ? <p className="mt-2 truncate text-sm text-slate-500">{sponsor.booth.link}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <WorkspaceEmptyState
            testId="sponsors-empty"
            title="No sponsor has arrived yet"
            line="Sponsors appear here when one enters with this event's sponsor code and gives their name. They write their own booth name, blurb and link from the sponsor portal, and the booth goes into the expo as soon as they save it. Copy the sponsor link from Access and send it to them."
            actionHref={`/app/events/${event.id}/access`}
            actionLabel="Get the sponsor link"
          />
        )}
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
