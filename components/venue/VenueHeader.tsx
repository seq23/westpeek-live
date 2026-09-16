import type { VirtualVenueModel } from "@/types/virtualVenue";
import { VenueNav } from "./VenueNav";
import { VenueStatusBar } from "./VenueStatusBar";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";

export function VenueHeader({ model, attendee }: { model: VirtualVenueModel; attendee?: { name: string; company: string } }) {
  return (
    <header className="rounded-[2rem] bg-brand-black p-5 text-white shadow-brand sm:p-6 lg:p-8">
      <WestPeekLiveWordmark size="sm" inverse />
      <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-brand-orange">Virtual venue</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">{model.eventName}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">Lobby, stage, sessions, breakouts, expo, networking, people, replay, and support in one event venue.</p>
      {attendee ? <p className="mt-3 text-sm text-white/80" data-testid="venue-header-attendee">You are in as <strong className="text-white">{attendee.name}</strong>{attendee.company ? ` · ${attendee.company}` : ""} · <a href={`/venue/${model.eventId}/lobby#tell-us-more`} className="font-black text-brand-orange underline" data-testid="venue-header-tell-us-more">Tell us more about you</a></p> : null}
      <div className="mt-5"><VenueStatusBar model={model} /></div>
      <div className="mt-5"><VenueNav items={model.nav} /></div>
    </header>
  );
}
