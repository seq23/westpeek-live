import type { VirtualVenueSession } from "@/types/virtualVenue";
import { LocalTimeWindow } from "@/components/shared/LocalTimeWindow";

const LABEL: Record<VirtualVenueSession["status"], string> = { live: "On now", upcoming: "Coming up", completed: "Finished" };

export function SessionCard({ session }: { session: VirtualVenueSession }) {
  return (
    <a href={session.roomHref} className="block rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-brand-orange">
      <p className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${session.status === "live" ? "bg-brand-orange text-white" : "bg-slate-100 text-slate-600"}`}>{LABEL[session.status]}</p>
      <h3 className="mt-2 text-xl font-black text-slate-950">{session.title}</h3>
      {/* The viewer's own clock: the venue is watched from anywhere, and the Worker's clock is UTC. */}
      <p className="mt-1 text-sm text-slate-500"><LocalTimeWindow startsAt={session.startsAt} endsAt={session.endsAt} /></p>
      {session.description ? <p className="mt-2 text-sm text-slate-600">{session.description}</p> : null}
      <p className="mt-3 text-sm text-slate-500">{session.speakerNames.join(", ") || "Speakers to be announced"}</p>
    </a>
  );
}
