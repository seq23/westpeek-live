import { AssetsAcrossEvents } from "@/components/assets/AssetsAcrossEvents";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/** Every file we hold, grouped by event. The acting happens on each event's own Assets page. */
export default function GlobalAssetsPage() {
  return <SafeSection label="Assets across events" render={() => AssetsAcrossEvents()} />;
}
