import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { renderMarkdownLite } from "@/lib/markdown/markdownLite";
import { markdownHeadings } from "@/lib/markdown/markdownOutline";
import { MANUAL_SOURCE } from "@/lib/manual/manualSource.generated";

export const dynamic = "force-dynamic";

/**
 * The manual, inside the app. One source of truth — docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md —
 * copied into a generated module at build time and rendered here with its screenshots. Owner and
 * operator reach it (the middleware gates /manual the way it gates the workspace); it carries no
 * codes by design, which a validator enforces on both the source and this page.
 */
export default function ManualPage() {
  const headings = markdownHeadings(MANUAL_SOURCE).filter((heading) => heading.level === 2);
  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:flex-row" data-testid="manual-page">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain rounded-3xl border border-brand-line bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-muted">Manual</p>
            <ul className="mt-2 space-y-1" data-testid="manual-toc">
              {headings.map((heading) => (
                <li key={heading.id}><Link href={`#${heading.id}`} className="block rounded-xl px-2 py-1 text-sm font-bold hover:bg-brand-ash hover:text-brand-orange">{heading.text}</Link></li>
              ))}
            </ul>
          </div>
        </aside>
        <article className="min-w-0 flex-1 rounded-3xl border border-brand-line bg-white p-5 sm:p-8" data-testid="manual-body">
          {renderMarkdownLite(MANUAL_SOURCE)}
        </article>
      </div>
    </AppShell>
  );
}
