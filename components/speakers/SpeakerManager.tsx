import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ComposeLink } from "@/components/email/ComposeLink";
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState";
import { SpeakerManagerSeedView } from "@/components/speakers/SpeakerManagerSeedView";
import { realRuntimeEvent } from "@/lib/workspace/realEvent";
import { listWorkspaceSpeakers } from "@/services/events/eventWorkspaceReadModel";

const STAGE_LABEL: Record<string, string> = { backstage: "backstage", invited: "invited to stage", on_stage: "on stage" };
const TECH_LABEL: Record<string, string> = { not_recorded: "not recorded", not_ready: "not ready", ready: "ready", warnings: "warnings" };

/**
 * The event's real speakers: the people who entered with the speaker code and gave their name. Who
 * they are, where they are (backstage / invited / on stage), their recorded tech check and whether
 * their cue deck is approved. Until 16 Sep 2026 this page showed the demo summit's speakers on
 * every event, the owner's own included.
 */
export async function SpeakerManager({ eventId }: { eventId: string }) {
  const event = realRuntimeEvent(eventId);
  if (!event) return <SpeakerManagerSeedView eventId={eventId} />;
  const speakers = await listWorkspaceSpeakers(event.id);

  return (
    <SectionCard title={`${event.name} speakers`} eyebrow={`${speakers.length} speaker${speakers.length === 1 ? "" : "s"}`}>
      <div data-testid="speaker-manager" data-count={speakers.length}>
        {/* Straight to the composer with this event and the speakers already picked. */}
        {speakers.length ? <p className="mb-4"><ComposeLink eventId={event.id} audience="speakers" label="Email speakers" /></p> : null}
        {speakers.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {speakers.map((speaker) => (
              <div key={speaker.guestId} className="rounded-2xl border border-slate-200 p-4" data-testid={`speaker-row-${speaker.guestId}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{speaker.name}</p>
                    <p className="text-sm text-slate-500">{[speaker.title, speaker.company].filter(Boolean).join(", ") || "No title or company given"}</p>
                  </div>
                  <StatusBadge status={STAGE_LABEL[speaker.stage]} tone={speaker.stage === "on_stage" ? "good" : "neutral"} />
                </div>
                <p className="mt-3 text-sm text-slate-500">Tech check: {TECH_LABEL[speaker.techCheck]}</p>
                <p className="mt-1 text-sm text-slate-500">Cue deck: {speaker.cueDeckPending ? "a version is waiting for your approval" : speaker.cueDeckApproved ? "approved" : "none yet"}</p>
              </div>
            ))}
          </div>
        ) : (
          <WorkspaceEmptyState
            testId="speakers-empty"
            title="No speaker has arrived yet"
            line="Speakers appear here the moment one enters with this event's speaker code and gives their name — no invite list to keep, no accounts to create. Their tech check, stage state and cue cards then fill in on their own. Copy the speaker link from Access and send it to them."
            actionHref={`/app/events/${event.id}/access`}
            actionLabel="Get the speaker link"
          />
        )}
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
