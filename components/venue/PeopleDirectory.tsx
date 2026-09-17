import type { VirtualVenuePerson } from "@/types/virtualVenue";
import { PeopleDirectoryCard } from "./PeopleDirectoryCard";
import { VenueBrowse } from "./VenueBrowse";

export function PeopleDirectory({ people }: { people: VirtualVenuePerson[] }) {
  return (
    <VenueBrowse
      eyebrow="People"
      title="Who else is here"
      intro="Everyone who registered and left themselves visible. Tap a name to see what they came for."
      count={people.length}
      empty={{ title: "Nobody is listed yet.", line: "People appear here as they register, unless they have hidden themselves.", testId: "people-empty" }}
    >
      <div className="grid gap-4 md:grid-cols-3">{people.map((person) => <PeopleDirectoryCard key={person.id} person={person} />)}</div>
    </VenueBrowse>
  );
}
