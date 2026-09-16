import { buildVirtualVenueModel } from "@/services/venue";
import { PeopleDirectory } from "@/components/venue/PeopleDirectory";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { VirtualVenuePerson } from "@/types/virtualVenue";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function PeoplePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  const registeredProfiles = await getRuntimeStore().listAttendeeProfiles(model.eventId, 100).catch(() => []);
  const registeredPeople: VirtualVenuePerson[] = registeredProfiles
    .filter((profile) => profile.networkingOptIn)
    .map((profile) => ({
      id: profile.attendeeId,
      displayName: profile.name,
      company: profile.company,
      title: profile.title,
      personalWebsite: profile.personalWebsite,
      socialLinks: profile.socialLinks,
      reasonForAttending: profile.reasonForAttending,
      interestingFact: profile.interestingFact,
      attendeeType: "attendee",
      networkingOptIn: profile.networkingOptIn,
    }));
  const peopleById = new Map<string, VirtualVenuePerson>();
  for (const person of [...model.people, ...registeredPeople]) peopleById.set(person.id, person);
  const mergedModel = { ...model, people: Array.from(peopleById.values()) };
  return (
    <VenuePageShell model={mergedModel}>
      <PeopleDirectory people={mergedModel.people} />
    </VenuePageShell>
  );
}
