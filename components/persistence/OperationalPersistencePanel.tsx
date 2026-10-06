export function OperationalPersistencePanel() {
  const rows = [
    ["Approval Queue", "approval_requests + approval_comments", "Approve, request changes, lock for show"],
    ["Production Inbox", "production_inbox_items", "Match, convert to asset/approval, archive"],
    ["Last-Minute Change Control", "last_minute_change_requests", "Approve, push live, rollback"],
    ["Asset Metadata", "assets", "Metadata only; file upload waits for Storage"],
  ];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">Batch 3C persistence foundation</p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-950">Producer ops reads and writes through the D1 service boundaries</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map(([label, table, action]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold text-slate-950">{label}</p><p className="mt-1 text-sm text-slate-500">{table}</p><p className="mt-2 text-sm text-slate-700">{action}</p></div>)}
      </div>
    </div>
  );
}
