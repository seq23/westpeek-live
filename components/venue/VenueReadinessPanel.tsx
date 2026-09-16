import type { VenueReadModel } from "@/types/venuePersistence";

export function VenueReadinessPanel({ model }: { model: VenueReadModel }) {
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Venue persistence</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">Venue operating model</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-2xl font-semibold">{model.attendees.length}</p>
          <p className="text-sm text-slate-600">Attendees</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-2xl font-semibold">{model.sessions.length}</p>
          <p className="text-sm text-slate-600">Sessions</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-2xl font-semibold">{model.expoBooths.length}</p>
          <p className="text-sm text-slate-600">Expo booths</p>
        </div>
      </div>
    </section>
  );
}
