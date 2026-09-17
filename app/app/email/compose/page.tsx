import { EmailComposer, type ComposerQuery } from "@/components/email/EmailComposer";
import { GroupEmailOverview } from "@/components/email/GroupEmailOverview";
import { UnsubscribeList } from "@/components/email/UnsubscribeList";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/**
 * Emailing a group — the thing the Email tab could not do.
 *
 * The event is a FIELD here, not the location: arriving with `?event=` pre-fills it (that is what
 * the "Email speakers" links next to the rosters do) and leaving it empty is an explicit, allowed
 * choice for a message to one person across events.
 */
export default async function EmailComposePage({ searchParams }: { searchParams?: Promise<ComposerQuery> }) {
  const query = searchParams ? await searchParams : undefined;
  return (
    <main className="space-y-6">
      <SafeSection label="Write to a group" render={() => EmailComposer({ query })} />
      <SafeSection label="Group email" render={() => GroupEmailOverview()} />
      <SafeSection label="Unsubscribed" render={() => UnsubscribeList()} />
    </main>
  );
}
