import { PublicEventPage } from "@/components/venue/PublicEventPage";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { SupersededCodeNotice } from "@/components/access/SupersededCodeNotice";

export default async function PublicEventRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ codeChanged?: string }> }) {
  const resolvedParams = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.slug);
  return (
    <>
      {query?.codeChanged ? <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-8"><SupersededCodeNotice oldCode={query.codeChanged} /></div> : null}
      <PublicEventPage slug={resolvedParams.slug} />
    </>
  );
}
