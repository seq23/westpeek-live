import type { ReactNode } from "react";
import { renderSafely } from "@/lib/ui/renderSafely";

/**
 * Fail soft. A section of a shared page (the crew deck, a venue page) that reads the runtime store
 * renders through this: the section is rendered HERE, inside the try, so a store failure — a
 * missing table, a schema drift, a provider error — becomes one visible "unavailable" card with
 * the section's name, and the rest of the page still renders. Without it one bad read took the
 * whole crew console down during a live workshop (16 Sep 2026).
 *
 * Usage: <SafeSection label="Speakers" render={() => SpeakerRosterPanel({ eventId, viewer })} />
 * The component is CALLED, not rendered as JSX, so its await happens inside the try.
 */
export async function SafeSection({ label, render, testId, compact = false }: { label: string; render: () => Promise<ReactNode> | ReactNode; testId?: string; compact?: boolean }) {
  const result = await renderSafely(label, render);
  if (result.ok) return <>{result.node}</>;
  return (
    <section className={`rounded-3xl border border-amber-200 bg-amber-50 text-amber-900 ${compact ? "p-3" : "p-5"}`} role="status" data-testid={testId || "section-unavailable"} data-section-unavailable={label}>
      <p className="text-xs font-black uppercase tracking-[0.25em]">{label}</p>
      <p className={`mt-1 font-black ${compact ? "text-sm" : "text-lg"}`}>{label} is unavailable right now.</p>
      <p className="mt-1 text-xs">The rest of this page still works. The production team can read the reason on /api/runtime/health. {result.message}</p>
    </section>
  );
}
