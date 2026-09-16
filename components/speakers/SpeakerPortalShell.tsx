import type { ReactNode } from "react";
import Link from "next/link";
import { findEventRecord } from "@/services/events/eventRepository";
import type { SpecialGuestProfile, SpeakerStageState } from "@/types/specialGuest";

const nav = [
  ["Speaker portal", ""],
  ["Green room", "green-room"],
  ["Tech check", "tech-check"],
  ["Cue cards", "teleprompter"],
  ["On stage", "backstage"],
];

export async function SpeakerPortalShell({ eventId, active, speaker, stage, children }: { eventId: string; active: string; speaker?: SpecialGuestProfile; stage?: SpeakerStageState; children: ReactNode }) {
  const event = await findEventRecord(eventId).catch(() => undefined);
  return (
    <main className="min-h-screen bg-brand-ash px-5 py-8 text-brand-black sm:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-8" data-testid="speaker-portal-shell" data-stage-status={stage?.status || "backstage"}>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Speaker portal</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{event?.name || eventId}</h1>
              <p className="mt-2 text-sm text-brand-muted">{speaker ? `${speaker.name}${speaker.company ? ` · ${speaker.company}` : ""}${speaker.title ? ` · ${speaker.title}` : ""}` : "You have not told us who you are yet."} · Event: {eventId}</p>
            </div>
            {stage?.status === "on_stage" ? <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800" data-testid="speaker-stage-badge">ON STAGE</span> : stage?.status === "invited" ? <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-black text-amber-800" data-testid="speaker-stage-badge">CREW IS BRINGING YOU TO THE STAGE</span> : <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700" data-testid="speaker-stage-badge">BACKSTAGE</span>}
          </div>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Speaker portal navigation">
            {nav.map(([label, suffix]) => {
              const href = suffix ? `/speaker/events/${eventId}/${suffix}` : `/speaker/events/${eventId}`;
              const selected = active === suffix || (!suffix && active === "home");
              return <Link key={label} href={href} className={`rounded-full px-4 py-2 text-sm font-bold ${selected ? "bg-brand-black text-white" : "border border-brand-line bg-white text-brand-black hover:border-brand-orange hover:text-brand-orange"}`}>{label}</Link>;
            })}
          </nav>
        </div>
        {children}
      </section>
    </main>
  );
}
