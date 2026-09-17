import { buildVirtualVenueModel } from "@/services/venue";
import { PeopleDirectory } from "@/components/venue/PeopleDirectory";
import { RegisterToTakePart } from "@/components/venue/RegisterToTakePart";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { VirtualVenuePerson } from "@/types/virtualVenue";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { visibleInDirectory } from "@/services/attendees/attendeeProfileMerge";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";

export default async function PeoplePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  const viewer = await getCurrentAttendeeProfile(model.eventId).catch(() => undefined);
  const registeredProfiles = await getRuntimeStore().listAttendeeProfiles(model.eventId, 100).catch(() => []);
  const registeredPeople: VirtualVenuePerson[] = registeredProfiles
    // Everyone registered is listed unless they switched "Hide me from the People directory" on.
    .filter((profile) => visibleInDirectory(profile))
    .map((profile) => ({
      id: profile.attendeeId,
      displayName: profile.name,
      company: profile.company,
      title: profile.title || undefined,
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
      {/* The one register card on this page, and the only one: appearing here is one of the things
          it names, so the directory's empty state no longer asks a second time. */}
      <RegisterToTakePart eventId={mergedModel.eventId} registered={Boolean(viewer)} returnTo={`/venue/${mergedModel.eventId}/people`} />
      <PeopleDirectory people={mergedModel.people} />
    </VenuePageShell>
  );
}
