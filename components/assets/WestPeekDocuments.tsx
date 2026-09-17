import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { LocalTime } from "@/components/shared/LocalTime";
import { readAllHowItWorksPages } from "@/services/content/howItWorksService";
import { documentDownloadPath, WEST_PEEK_DOCUMENTS } from "@/services/documents/westPeekDocuments";

/**
 * The manual and the five instruction pages, downloadable as Markdown.
 *
 * Separate group, separate everything: these are documents, not uploads. They are not asset rows,
 * they belong to no event, and they go nowhere near the asset store — so there is no Archive on
 * them, no delete, and nothing here can move an event's file count. The instruction downloads are
 * generated from the live page at click time, which is the only honest way to hand somebody a copy
 * of something that is edited in place.
 */
export async function WestPeekDocuments() {
  const pages = await readAllHowItWorksPages().catch(() => []);
  const edited = new Map(pages.map((page) => [`how-it-works-${page.slug}`, page]));
  return (
    <SectionCard title="West Peek documents" eyebrow={`${WEST_PEEK_DOCUMENTS.length} documents · always current`}>
      <div data-testid="west-peek-documents" data-count={WEST_PEEK_DOCUMENTS.length}>
        <p className="text-sm text-brand-muted">
          The manual, and the five instruction pages we put on landing pages and in emails. Download any of them as Markdown to send on, print, or paste into a deck. These are not uploads: they belong to no event, they cannot be archived or deleted here, and they are never counted as an event&rsquo;s files.
        </p>
        <ul className="mt-4 space-y-2">
          {WEST_PEEK_DOCUMENTS.map((document) => {
            const page = edited.get(document.id);
            return (
              <li key={document.id} className="flex flex-col gap-2 rounded-2xl border border-brand-line p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`document-row-${document.id}`}>
                <div>
                  <p className="font-black text-brand-black">{document.title}</p>
                  <p className="text-xs text-brand-muted">{document.gist}</p>
                  <p className="mt-1 text-[11px] text-brand-muted">
                    From {document.source}.
                    {page ? page.isDefault ? " Still the first draft that shipped." : <> Last edited by {page.updatedByLabel || "someone"} · <LocalTime iso={page.updatedAt} mode="datetime" />.</> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link href={document.viewPath} className="rounded-full border border-brand-line px-3 py-2 text-xs font-black hover:border-brand-orange hover:text-brand-orange" data-testid={`document-view-${document.id}`}>Read it</Link>
                  <a href={documentDownloadPath(document.id)} className="rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white hover:bg-brand-orange" data-testid={`document-download-${document.id}`}>Download .md</a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionCard>
  );
}
