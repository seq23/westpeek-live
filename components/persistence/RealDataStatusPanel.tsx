import { SectionCard } from "@/components/shared/SectionCard";

export function RealDataStatusPanel() {
  return (
    <SectionCard title="Real data wiring status" eyebrow="Phase 4 readiness">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">Auth</p>
          <p className="text-sm text-slate-600">Session-aware (app-owned login on D1).</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">Clients / Events</p>
          <p className="text-sm text-slate-600">Persistence services and actions are wired.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">Production Ops</p>
          <p className="text-sm text-slate-600">Approval, inbox, change, assets, and workflow foundations exist.</p>
        </div>
      </div>
    </SectionCard>
  );
}
