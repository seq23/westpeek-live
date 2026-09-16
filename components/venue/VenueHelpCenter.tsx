import type { VirtualVenueModel } from "@/types/virtualVenue";
import { HelpRequestForm } from "./HelpRequestForm";
import { SafeSection } from "@/components/system/SafeSection";
import { VenueSection } from "@/components/venue/VenueSection";

const supportHref =
  "mailto:info@westpeek.ventures?subject=West%20Peek%20Live%20Event%20Help";

function HelpCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <a href={href} className="rounded-3xl border border-brand-line bg-white p-5 transition hover:-translate-y-0.5">
      <p className="text-sm font-black text-brand-black">{title}</p>
      <p className="mt-2 text-sm leading-6 text-brand-muted">{description}</p>
    </a>
  );
}

const troubleshooting = [
  {
    title: "If the livestream is not loading",
    items: ["Refresh the page.", "Check your internet connection.", "Return to the lobby and reopen the stage.", "Try another supported browser.", "Contact support if the issue continues."],
  },
  {
    title: "If audio is not working",
    items: ["Check your device volume.", "Check whether the browser tab is muted.", "Reconnect headphones or speakers.", "Refresh the stage page."],
  },
  {
    title: "If your event code does not work",
    items: ["Confirm the code from your invitation.", "Try the Join Event page again.", "Contact the event organizer or West Peek support."],
  },
  {
    title: "If you are lost inside the venue",
    items: ["Return to the Lobby.", "Use the venue navigation for Stage, Sessions, Expo, Networking, Replay, or Help.", "Open the Help page again if you need a reset point."],
  },
  {
    title: "If speaker, sponsor, client, VIP, or crew access is not working",
    items: ["Use the access link and role-scoped code from your production contact.", "Confirm the event code.", "Contact the event organizer or West Peek support."],
  },
];

export function VenueHelpCenter({ model }: { model: VirtualVenueModel }) {
  const eventId = model.eventId;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-orange">Event Help</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">Need help with this event?</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-muted">
          Something not working, or not sure where to go? Start here. If none of it helps, the last card emails us and
          somebody reads it. Company and privacy questions also go to info@westpeek.ventures.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Fast help actions">
        <HelpCard title="Back to Lobby" description="Return to the event home base." href={`/venue/${eventId}/lobby`} />
        <HelpCard title="Go to Stage" description="Open the main livestream and chat surface." href={`/venue/${eventId}/stage`} />
        <HelpCard title="View Sessions" description="Find agenda sessions and room links." href={`/venue/${eventId}/sessions`} />
        <HelpCard title="Open Expo" description="Find sponsor and exhibitor booths." href={`/venue/${eventId}/expo`} />
        <HelpCard title="Open Networking" description="Return to networking and matching surfaces." href={`/venue/${eventId}/networking`} />
        <HelpCard title="View Replay" description="Find available replay and archive surfaces." href={`/venue/${eventId}/replay`} />
        <HelpCard title="Contact Support" description="Email West Peek support. Do not include passwords, private codes, payment information, or secret keys." href={supportHref} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          {troubleshooting.map((block) => (
            <VenueSection key={block.title} storageKey={`help-${eventId}-${block.title.slice(0, 24)}`} title={block.title} testId="help-troubleshooting-section">
              <ul className="space-y-2 text-sm leading-6 text-brand-muted">
                {block.items.map((item) => <li key={item}>· {item}</li>)}
              </ul>
            </VenueSection>
          ))}
        </div>

        <SafeSection label="Help request" render={() => HelpRequestForm({ eventId: eventId, topics: model.helpTopics })} />
      </div>
    </div>
  );
}
