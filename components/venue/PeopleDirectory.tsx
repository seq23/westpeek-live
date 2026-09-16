import type { VirtualVenuePerson } from "@/types/virtualVenue";
import { PeopleDirectoryCard } from "./PeopleDirectoryCard";
import { VenueBrowse } from "./VenueBrowse";

export function PeopleDirectory({ people, eventId }: { people: VirtualVenuePerson[]; eventId?: string }) {
  return (
    <VenueBrowse
      eyebrow="People"
      title="Who else is here"
      intro="Everyone who registered and left themselves visible. Tap a name to see what they came for."
      count={people.length}
      empty={{ title: "Nobody is listed yet.", line: "People appear here as they register. Register yourself and you will be the first.", actionHref: eventId ? `/events/${eventId}/register` : undefined, actionLabel: "Register", testId: "people-empty" }}
    >
      <div className="grid gap-4 md:grid-cols-3">{people.map((person) => <PeopleDirectoryCard key={person.id} person={person} />)}</div>
    </VenueBrowse>
  );
}
