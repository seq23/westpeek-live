import { AssetsAcrossEvents } from "@/components/assets/AssetsAcrossEvents";
import { WestPeekDocuments } from "@/components/assets/WestPeekDocuments";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/**
 * Two things live here, and they are different things.
 *
 * The West Peek documents are ours — the manual and the five instruction pages — downloadable as
 * Markdown and belonging to no event. Below them, every file we hold for an event, grouped by
 * event; the acting on those happens on each event's own Assets page.
 */
export default function GlobalAssetsPage() {
  return (
    <main className="space-y-6">
      <SafeSection label="West Peek documents" render={() => WestPeekDocuments()} />
      <SafeSection label="Assets across events" render={() => AssetsAcrossEvents()} />
    </main>
  );
}
