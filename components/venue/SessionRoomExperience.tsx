import type { VirtualVenueModel, VirtualVenueSession } from "@/types/virtualVenue";
import { LiveKitVideoSurface } from "./LiveKitVideoSurface";

export function SessionRoomExperience({ model, session }: { model: VirtualVenueModel; session: VirtualVenueSession }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      <section className="rounded-3xl bg-white p-5">
        <LiveKitVideoSurface label={session.title} />
        <h2 className="mt-5 text-2xl font-semibold">{session.title}</h2>
        <p className="mt-2 text-slate-600">{session.description}</p>
        <p className="mt-3 text-sm text-slate-500">Speakers: {session.speakerNames.join(", ") || "Event team"}</p>
      </section>
      <aside className="space-y-4">
        <section className="rounded-3xl bg-white p-5"><h3 className="font-semibold">Q&A</h3><p className="mt-2 text-sm text-slate-600">Questions are collected and prepared for producer moderation.</p></section>
        <section className="rounded-3xl bg-white p-5"><h3 className="font-semibold">Polls</h3><p className="mt-2 text-sm text-slate-600">Polls are available for session engagement.</p></section>
        <a href={`/venue/${model.eventId}/lobby`} className="block rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white">Back to lobby</a>
      </aside>
    </div>
  );
}
