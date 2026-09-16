export function EventNotOpenState({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Event not open</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">{title}</h1>
        <p className="mt-3 text-slate-600">{message}</p>
        <a href="/join" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Back to Join Event</a>
      </section>
    </main>
  );
}
