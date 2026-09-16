import { getEvent, getSessionsForEvent, getSponsorBoothsForEvent, getRuntimeData } from "@/lib/runtime/getRuntimeData";
import { excludePreviewIdentities } from "@/lib/auth/previewIdentity";
import type {
  VenueNavItem,
  VirtualVenueBooth,
  VirtualVenueBreakout,
  VirtualVenueModel,
  VirtualVenuePerson,
  VirtualVenueReplay,
  VirtualVenueSession,
} from "@/types/virtualVenue";

function nav(eventId: string): VenueNavItem[] {
  const base = `/venue/${eventId}`;
  return [
    ["lobby", "Lobby", `${base}/lobby`, "open"],
    ["stage", "Stage", `${base}/stage`, "live"],
    ["sessions", "Sessions", `${base}/sessions`, "open"],
    ["breakouts", "Breakouts", `${base}/breakouts`, "open"],
    ["expo", "Expo", `${base}/expo`, "open"],
    ["networking", "Networking", `${base}/networking`, "available"],
    ["people", "People", `${base}/people`, "available"],
    ["replay", "Replay", `${base}/replay`, "processing"],
    ["run-of-show", "Run of Show", `${base}/run-of-show`, "live"],
    ["help", "Help", `${base}/help`, "available"],
  ].map(([surface, label, href, status]) => ({ surface, label, href, status })) as VenueNavItem[];
}

export function buildVirtualVenueModel(eventId: string): VirtualVenueModel {
  const event = getEvent(eventId);
  const data = getRuntimeData();
  const sessions: VirtualVenueSession[] = getSessionsForEvent(event.id).map((session, index) => ({
    id: session.id,
    title: session.name,
    description: session.description,
    startsAt: session.startAt,
    endsAt: session.endAt,
    status: index === 0 ? "live" : index < 3 ? "upcoming" : "completed",
    roomHref: `/venue/${event.id}/sessions/${session.id}`,
    speakerNames: data.speakers.filter((speaker) => speaker.eventId === event.id).slice(0, 2).map((speaker) => speaker.name),
  }));

  const booths: VirtualVenueBooth[] = getSponsorBoothsForEvent(event.id).map((booth) => ({
    id: booth.id,
    name: booth.name,
    headline: booth.name,
    description: booth.description,
    href: `/venue/${event.id}/expo/${booth.id}`,
    ctaLabel: "Visit booth",
  }));

  const speakerPeople: VirtualVenuePerson[] = data.speakers
    .filter((speaker) => speaker.eventId === event.id)
    .map((speaker, index) => ({
      id: speaker.id,
      displayName: speaker.name,
      company: speaker.company,
      title: speaker.title,
      personalWebsite: `/venue/${event.id}/people#${speaker.id}`,
      socialLinks: [`/speaker/events/${event.id}`],
      reasonForAttending: "Sharing practical lessons with operators building better event systems.",
      interestingFact: index === 0 ? "I once rebuilt a conference run-of-show overnight after a venue outage." : "I always bring one unconventional question to every networking room.",
      attendeeType: "speaker",
      networkingOptIn: true,
    }));

  const sponsorPeople: VirtualVenuePerson[] = data.sponsors
    .filter((sponsor) => sponsor.eventId === event.id)
    .slice(0, 3)
    .map((sponsor, index) => ({
      id: `person-${sponsor.id}`,
      displayName: `${sponsor.name} Lead`,
      company: sponsor.name,
      title: index === 0 ? "Partnerships Lead" : "Community Lead",
      personalWebsite: sponsor.websiteUrl,
      socialLinks: sponsor.websiteUrl ? [sponsor.websiteUrl] : [],
      reasonForAttending: "Meeting teams that care about high-trust virtual event experiences.",
      interestingFact: "I can usually tell how healthy an event is by watching the help queue for five minutes.",
      attendeeType: "sponsor",
      networkingOptIn: true,
    }));

  const registeredPeople: VirtualVenuePerson[] = data.attendees
    .filter((attendee) => attendee.eventId === event.id)
    .slice(0, 6)
    .map((attendee, index) => ({
      id: attendee.id,
      displayName: attendee.name,
      company: attendee.company,
      title: attendee.title,
      personalWebsite: attendee.website,
      socialLinks: attendee.socialLinks,
      reasonForAttending: attendee.reasonForAttending || "Learning from operators and meeting peers.",
      interestingFact: attendee.interestingFact || (index % 2 === 0 ? "I keep a handwritten conference notebook." : "I prefer small-group conversations over giant panels."),
      attendeeType: "attendee",
      networkingOptIn: true,
    }));

  // Nobody in the room is a preview: not in the directory, not in the lobby strip, not in a count.
  const people: VirtualVenuePerson[] = excludePreviewIdentities([...speakerPeople, ...sponsorPeople, ...registeredPeople], (person) => person.id);

  const breakouts: VirtualVenueBreakout[] = sessions.slice(0, 3).map((session, index) => ({
    id: `breakout-${session.id}`,
    title: `${session.title} discussion`,
    description: "Small-group room for attendee conversation and moderated discussion.",
    hostName: session.speakerNames[0] ?? "Event host",
    capacity: 25,
    currentCount: 6 + index * 3,
    status: "open",
    href: `/venue/${event.id}/breakouts?room=breakout-${session.id}`,
  }));

  const replays: VirtualVenueReplay[] = sessions.slice(0, 4).map((session, index) => ({
    id: `replay-${session.id}`,
    title: session.title,
    status: index === 0 ? "processing" : "available",
    durationSeconds: 1800 + index * 300,
    href: `/venue/${event.id}/replay#replay-${session.id}`,
  }));

  return {
    eventId: event.id,
    eventName: event.name,
    nav: nav(event.id),
    liveNow: sessions.filter((session) => session.status === "live"),
    upNext: sessions.filter((session) => session.status === "upcoming"),
    sessions,
    breakouts,
    booths,
    people,
    replays,
    helpTopics: ["Video/audio issue", "Cannot join room", "Schedule question", "Sponsor/expo issue", "Networking issue", "Accessibility request", "Other"],
  };
}

export function getVenueSurface(model: VirtualVenueModel, surface: VenueNavItem["surface"]) {
  return model.nav.find((item) => item.surface === surface);
}
