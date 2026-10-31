import type { EventReport } from "@/services/reports/eventReport";

const TIMING_LABEL = { on_time: "On time", late: "Late", skipped: "Skipped", not_timed: "Not timed", not_run: "Did not run" } as const;

/**
 * The report's figures, laid out once and used twice — the producer's report page and the client
 * portal — so the two can never show different numbers.
 */
export function EventReportView({ report }: { report: EventReport }) {
  return (
    <div className="space-y-4" data-testid="event-report">
      {report.sections.map((section) => (
        <section key={section.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid={`report-section-${section.id}`}>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{section.title}</p>
          {section.figures.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {section.figures.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4" data-testid={`report-figure-${item.id}`} data-value={item.value}>
                  <p className="text-xs uppercase text-slate-500">{item.label}</p>
                  <p className="text-2xl font-black text-slate-950">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Nothing of this kind was recorded for this event.</p>
          )}
          {section.id === "show" && report.segments.length ? (
            <ol className="mt-4 space-y-1 text-sm" data-testid="report-segment-timing">
              {report.segments.map((segment) => (
                <li key={segment.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <span>{segment.title}</span>
                  <span className="font-semibold text-slate-700">{TIMING_LABEL[segment.timing]}{segment.startedLateMinutes ? ` · started ${segment.startedLateMinutes} min late` : ""}{segment.overranMinutes ? ` · ran ${segment.overranMinutes} min over` : ""}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ))}
    </div>
  );
}
