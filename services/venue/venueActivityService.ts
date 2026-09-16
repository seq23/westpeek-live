import { getNetworkingSettings } from "@/services/speed-networking/speedNetworkingService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { getPublicStageStreamState } from "@/services/video/stageStreamStateService";
import type { VenueSurface, VirtualVenueModel } from "@/types/virtualVenue";

/**
 * What is actually happening in the venue right now, so the nav can be a map of activity instead
 * of a list of nouns (the owner, 16 Sep 2026: "how do attendees know they can click Networking to
 * network?"). Every field here is a real, currently-true signal read from the runtime store — a
 * marker is rendered only where one of these is true, never invented and never a zero.
 */
export interface VenueActivity {
  stageLive: boolean;
  liveSessionTitle?: string;
  networkingOpen: boolean;
  networkingQueueSize: number;
  networkingMatchMinutes: number;
  boothCount: number;
  breakoutsOpen: number;
  replaysReady: number;
  peopleListed: number;
}

export const EMPTY_VENUE_ACTIVITY: VenueActivity = {
  stageLive: false,
  networkingOpen: false,
  networkingQueueSize: 0,
  networkingMatchMinutes: 0,
  boothCount: 0,
  breakoutsOpen: 0,
  replaysReady: 0,
  peopleListed: 0,
};

/** Fail soft: every read is independent, and a store failure drops that one marker, not the nav. */
export async function getVenueActivity(model: VirtualVenueModel): Promise<VenueActivity> {
  const [settings, entries, stage] = await Promise.all([
    getNetworkingSettings(model.eventId).catch(() => undefined),
    getRuntimeStore().listSpeedNetworkingEntries(model.eventId).catch(() => []),
    getPublicStageStreamState(model.eventId, "main-stage").catch(() => undefined),
  ]);
  return {
    // "Live" is the provider actually carrying a picture, or a session the model says is on now.
    stageLive: Boolean(stage && /_LIVE$/.test(stage.streamStatus)) || model.liveNow.length > 0,
    liveSessionTitle: model.liveNow[0]?.title,
    networkingOpen: Boolean(settings?.open),
    networkingQueueSize: entries.filter((entry) => entry.status === "waiting").length,
    networkingMatchMinutes: settings?.matchMinutes || 0,
    boothCount: model.booths.length,
    breakoutsOpen: model.breakouts.filter((room) => room.status === "open").length,
    replaysReady: model.replays.filter((replay) => replay.status === "available").length,
    peopleListed: model.people.length,
  };
}

export interface VenueNavMarker { label: string; tone: "live" | "open" | "count" }

/**
 * One marker per surface, or none. "None" is the common case and is correct: a marker reading 0
 * tells a newcomer nothing except that something is missing (the owner walked the venue and found
 * "EXPO 0" repeated on all nine pages).
 */
export function navMarkerFor(surface: VenueSurface, activity: VenueActivity): VenueNavMarker | undefined {
  if (surface === "stage" && activity.stageLive) return { label: "Live", tone: "live" };
  if (surface === "networking" && activity.networkingOpen) {
    return activity.networkingQueueSize > 0
      ? { label: `${activity.networkingQueueSize} waiting`, tone: "open" }
      : { label: "Open", tone: "open" };
  }
  if (surface === "expo" && activity.boothCount > 0) return { label: String(activity.boothCount), tone: "count" };
  if (surface === "breakouts" && activity.breakoutsOpen > 0) return { label: String(activity.breakoutsOpen), tone: "count" };
  if (surface === "replay" && activity.replaysReady > 0) return { label: String(activity.replaysReady), tone: "count" };
  if (surface === "people" && activity.peopleListed > 0) return { label: String(activity.peopleListed), tone: "count" };
  return undefined;
}
