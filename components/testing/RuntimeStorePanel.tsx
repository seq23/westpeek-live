export function RuntimeStorePanel() {
  const items = ['file runtime store (local)', 'D1 runtime store (production, binding DB)', 'R2 event assets (binding ASSETS_BUCKET)', 'audit/events/fallback/analytics'];
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Runtime store</h2>
      <ul className="mt-3 grid gap-2 text-sm">{items.map((item) => <li key={item} className="rounded-xl bg-slate-50 p-2">{item}</li>)}</ul>
    </section>
  );
}
