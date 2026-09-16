import { EventTemplateLibrary } from "@/components/events/EventTemplateLibrary";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/** Templates: the starting points you have saved, and the two ways to make one. */
export default async function TemplatesPage({ searchParams }: { searchParams?: Promise<{ saved?: string; templateError?: string; deleted?: string }> }) {
  const query = searchParams ? await searchParams : undefined;
  return <SafeSection label="Event templates" render={() => EventTemplateLibrary({ saved: query?.saved, error: query?.templateError, deleted: query?.deleted })} />;
}
