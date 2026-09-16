import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { AttendeeLiveCapability, AttendeeLiveRoomKind } from "@/types/attendeeLive";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { LiveChatMessage, LiveChatModerationState } from "@/types/liveChat";

export const ROSTER_LIMIT = 200;

export type AttendeeLiveStatus = "open" | "requested" | "declined" | "permitted" | "approved_to_publish" | "revoked";

export interface AttendeeRosterRow {
  attendeeId: string;
  name: string;
  company: string;
  title: string;
  emailMasked?: string;
  registeredAt: string;
  capability?: AttendeeLiveCapability;
  liveStatus: AttendeeLiveStatus;
  silenced: boolean;
  lastChatAt?: string;
}

export interface AttendeeRoster {
  eventId: string;
  roomKind: AttendeeLiveRoomKind;
  roomId: string;
  search: string;
  /** Rows after search, bounded. */
  rows: AttendeeRosterRow[];
  /** Registered attendees on the event before search (bounded by ROSTER_LIMIT). */
  total: number;
  pending: AttendeeRosterRow[];
}

export function liveStatusOf(capability?: AttendeeLiveCapability): AttendeeLiveStatus {
  if (!capability) return "open";
  if (capability.revoked) return "revoked";
  if (capability.approvedForStage) return "approved_to_publish";
  if (capability.requestStatus === "requested") return "requested";
  if (capability.canJoinLiveStream) return "permitted";
  if (capability.requestStatus === "declined") return "declined";
  return "open";
}

export function liveStatusLabel(status: AttendeeLiveStatus) {
  return {
    open: "Registered · no live decision",
    requested: "Stage request pending",
    declined: "Stage request declined",
    permitted: "Permitted to watch",
    approved_to_publish: "Approved to publish (camera + mic)",
    revoked: "Revoked",
  }[status];
}

function matches(profile: AttendeeProfile, search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [profile.name, profile.company, profile.title, profile.attendeeId, profile.emailMasked || ""].some((value) => value.toLowerCase().includes(needle));
}

/**
 * Everyone registered for the event (latest ROSTER_LIMIT), joined with their live capability in
 * the given room, whether they are silenced there, and when they last posted in chat. Pending
 * stage requests are surfaced separately, oldest first, so the crew works the queue in order.
 * A request from an attendee whose profile is gone still shows (by id) rather than vanishing.
 */
export async function getAttendeeRoster(input: { eventId: string; roomKind?: AttendeeLiveRoomKind; roomId?: string; search?: string; limit?: number }): Promise<AttendeeRoster> {
  const store = getRuntimeStore();
  const roomKind = input.roomKind || "main_stage";
  const roomId = input.roomId || "main-stage";
  const search = (input.search || "").trim();
  const limit = Math.min(Math.max(1, input.limit || ROSTER_LIMIT), ROSTER_LIMIT);
  const [profiles, capabilities, moderation, recentChat] = await Promise.all([
    store.listAttendeeProfiles(input.eventId, ROSTER_LIMIT).catch(() => [] as AttendeeProfile[]),
    store.listAttendeeLiveCapabilities(input.eventId).catch(() => [] as AttendeeLiveCapability[]),
    store.listLiveChatModerationStates(input.eventId).catch(() => [] as LiveChatModerationState[]),
    store.listRecentLiveChatMessages(input.eventId, 500).catch(() => [] as LiveChatMessage[]),
  ]);
  const capabilityByAttendee = new Map(capabilities.filter((item) => item.roomKind === roomKind && item.roomId === roomId).map((item) => [item.attendeeId, item]));
  const silenced = new Set(moderation.filter((state) => state.scope === "attendee" && state.silenced && state.roomKind === roomKind && state.roomId === roomId).map((state) => state.attendeeId as string));
  const lastChat = new Map<string, string>();
  for (const message of recentChat) if (message.attendeeId && !lastChat.has(message.attendeeId)) lastChat.set(message.attendeeId, message.createdAt);

  const toRow = (profile: AttendeeProfile): AttendeeRosterRow => {
    const capability = capabilityByAttendee.get(profile.attendeeId);
    return { attendeeId: profile.attendeeId, name: profile.name, company: profile.company, title: profile.title, emailMasked: profile.emailMasked, registeredAt: profile.createdAt, capability, liveStatus: liveStatusOf(capability), silenced: silenced.has(profile.attendeeId), lastChatAt: lastChat.get(profile.attendeeId) };
  };
  const sorted = profiles.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const rows = sorted.filter((profile) => matches(profile, search)).slice(0, limit).map(toRow);

  const profileById = new Map(sorted.map((profile) => [profile.attendeeId, profile]));
  const pending = capabilities
    .filter((item) => item.roomKind === roomKind && item.roomId === roomId && item.requestStatus === "requested" && !item.revoked)
    .sort((a, b) => String(a.requestedAt || a.updatedAt).localeCompare(String(b.requestedAt || b.updatedAt)))
    .map((capability) => {
      const profile = profileById.get(capability.attendeeId);
      return profile ? toRow(profile) : { attendeeId: capability.attendeeId, name: capability.attendeeId, company: "Profile not found", title: "", registeredAt: capability.requestedAt || capability.updatedAt, capability, liveStatus: "requested" as const, silenced: silenced.has(capability.attendeeId), lastChatAt: lastChat.get(capability.attendeeId) };
    });

  return { eventId: input.eventId, roomKind, roomId, search, rows, total: profiles.length, pending };
}
