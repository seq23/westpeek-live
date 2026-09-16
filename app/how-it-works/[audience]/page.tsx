import { notFound } from "next/navigation";
import Link from "next/link";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { HowItWorksEditor } from "@/components/how-it-works/HowItWorksEditor";
import { renderMarkdownLite } from "@/lib/markdown/markdownLite";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { readHowItWorksPage } from "@/services/content/howItWorksService";
import { HOW_IT_WORKS_AUDIENCES, isHowItWorksAudience } from "@/types/howItWorks";

/**
 * One instruction page per audience: client, crew, speaker, sponsor, attendee.
 *
 * These are what the instruction emails LINK to. They are public on purpose, because somebody
 * forwarded the link to a colleague and that colleague needs to read it too, and because a page
 * behind a gate is a page people screenshot instead. The content comes from the runtime store, so
 * West Peek edits it here without a deploy; owner and operator see the editor, everybody else sees
 * the page and nothing else.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  if (!isHowItWorksAudience(audience)) return { title: "How it works | West Peek Live" };
  const page = await readHowItWorksPage(audience);
  return { title: `${page.title} | West Peek Live`, description: page.intro };
}

export default async function HowItWorksAudiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ audience: string }>;
  searchParams?: Promise<{ saved?: string; editError?: string }>;
}) {
  const { audience } = await params;
  if (!isHowItWorksAudience(audience)) notFound();

  const [page, actor, query] = await Promise.all([
    readHowItWorksPage(audience),
    getWorkspaceActor(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const canEdit = actor?.kind === "owner" || actor?.kind === "operator";

  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
        <article className="mx-auto max-w-3xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10" data-testid={`how-it-works-${audience}`} data-default={page.isDefault ? "true" : "false"}>
          <WestPeekProductionsLogo size="md" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">How it works</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight" data-testid="how-it-works-heading">{page.title}</h1>
          <p className="mt-4 text-sm leading-6 text-brand-muted">{page.intro}</p>
          <div className="mt-8 space-y-1 text-sm leading-7" data-testid="how-it-works-body-rendered">{renderMarkdownLite(page.body)}</div>

          <nav className="mt-10 border-t border-brand-line pt-5 text-xs text-brand-muted">
            <p className="font-black uppercase tracking-[0.25em]">The other instruction pages</p>
            <p className="mt-2 flex flex-wrap gap-3">
              {HOW_IT_WORKS_AUDIENCES.filter((other) => other !== audience).map((other) => (
                <Link key={other} href={`/how-it-works/${other}`} className="font-bold underline">{other}</Link>
              ))}
            </p>
          </nav>

          {canEdit ? <HowItWorksEditor page={page} saved={query?.saved === "1"} error={query?.editError} /> : null}
        </article>
      </main>
      <LegalFooter />
    </>
  );
}
