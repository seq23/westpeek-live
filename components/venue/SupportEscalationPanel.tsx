export function SupportEscalationPanel({ eventId }: { eventId: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="font-black text-slate-950">Need help?</h2>
      <p className="mt-2 text-sm text-slate-600">Support requests are tracked as runtime events so the production team can see attendee issues.</p>
      <a href={`/venue/${eventId}/help`} className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Open help center</a>
    </section>
  );
}
