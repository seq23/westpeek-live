/**
 * Identity and state for the people who enter through the special-guest gate
 * (event code + role code): speakers, sponsors, VIPs, clients.
 *
 * The role code carries the event and the role, not the person. On first entry the
 * guest gives name / company / title once; that becomes a SpecialGuestProfile row bound
 * to their browser by the wpl_guest_identity cookie, the way an attendee's session
 * cookie binds their AttendeeProfile.
 */
export type SpecialGuestRole = "speaker" | "sponsor" | "vip" | "client";

export interface SpecialGuestProfile {
  guestId: string;
  eventId: string;
  role: SpecialGuestRole;
  name: string;
  company: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type EventGuestStateKind = "speaker_stage" | "speaker_tech_check" | "speaker_cue_deck" | "speaker_live_cue" | "producer_notes" | "sponsor_booth" | "vip_room";

/** One row per standing decision or document, keyed eventId:kind[:guestId]. */
export interface EventGuestStateRecord<T = unknown> {
  key: string;
  eventId: string;
  kind: EventGuestStateKind;
  guestId?: string;
  state: T;
  updatedAt: string;
}

export function eventGuestStateKey(eventId: string, kind: EventGuestStateKind, guestId?: string) {
  return guestId ? `${eventId}:${kind}:${guestId}` : `${eventId}:${kind}`;
}

// ---- speaker ---------------------------------------------------------------

export type SpeakerStageStatus = "backstage" | "invited" | "on_stage";

export interface SpeakerStageState {
  status: SpeakerStageStatus;
  updatedBy: string;
  updatedAt: string;
  invitedAt?: string;
  wentOnStageAt?: string;
}

export interface SpeakerTechCheckState {
  status: "not_ready" | "ready" | "warnings";
  score: number;
  checks: Array<{ kind: string; status: string; summary?: string }>;
  recordedAt: string;
}

export interface CueCard {
  id: string;
  title: string;
  body: string;
}

export interface CueDeckVersion {
  id: string;
  versionNumber: number;
  cards: CueCard[];
  talkingPoints: string[];
  script?: string;
  author: "producer" | "speaker";
  authorLabel: string;
  status: "approved" | "pending";
  submittedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SpeakerCueDeckState {
  approved?: CueDeckVersion;
  pending?: CueDeckVersion;
  nextVersionNumber: number;
}

export interface SpeakerLiveCueState {
  text: string;
  pushedBy: string;
  pushedAt: string;
}

export interface ProducerNotesState {
  text: string;
  updatedBy: string;
  updatedAt: string;
}

// ---- sponsor / vip ---------------------------------------------------------

export interface SponsorBoothState {
  boothName: string;
  blurb: string;
  link: string;
  published: boolean;
  updatedAt: string;
}

export interface VipRoomState {
  open: boolean;
  roomId: string;
  label: string;
  updatedBy: string;
  updatedAt: string;
}

export const GREEN_ROOM_ID = "green-room";
export const VIP_ROOM_ID = "vip-lounge";
