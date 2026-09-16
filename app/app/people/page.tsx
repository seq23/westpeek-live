import { ContactsAcrossEvents } from "@/components/people/ContactsAcrossEvents";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/** The owner's people list across every event, with the CSV export. */
export default async function PeopleAcrossEventsPage() {
  return <SafeSection label="People across events" render={() => ContactsAcrossEvents({})} />;
}
