export type ID = string;

export type EventStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "pre_event"
  | "live"
  | "ended"
  | "replay_available"
  | "archived";

export type EventType =
  | "virtual_summit"
  | "webinar"
  | "demo_day"
  | "sponsor_expo"
  | "paid_workshop"
  | "executive_roundtable"
  | "community_event"
  | "course_launch"
  | "internal_town_hall"
  | "hybrid_support";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "waiting_on_client"
  | "waiting_on_speaker"
  | "waiting_on_sponsor"
  | "waiting_on_vendor"
  | "complete"
  | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "critical";

export type ApprovalStatus =
  | "draft"
  | "needs_agency_review"
  | "sent_to_client"
  | "client_changes_requested"
  | "approved"
  | "locked"
  | "cancelled";

export type ReadinessStatus = "blocked" | "at_risk" | "needs_attention" | "ready";

export type SpeakerReadinessStatus =
  | "invited"
  | "confirmed"
  | "bio_submitted"
  | "headshot_submitted"
  | "deck_submitted"
  | "release_signed"
  | "tech_check_scheduled"
  | "tech_check_completed"
  | "ready"
  | "blocked";

export type SponsorReadinessStatus =
  | "prospect"
  | "invited"
  | "contracted"
  | "assets_requested"
  | "assets_submitted"
  | "booth_drafted"
  | "booth_approved"
  | "live"
  | "report_delivered"
  | "cancelled";

export type AssetStatus =
  | "draft"
  | "uploaded"
  | "submitted"
  | "needs_review"
  | "approved"
  | "changes_requested"
  | "locked"
  | "archived";

export type VideoRoomStatus = "scheduled" | "open" | "live" | "closed" | "recording" | "replay_ready" | "failed";
export type VideoRoomType = "main_stage" | "backstage" | "breakout_session" | "networking_match" | "sponsor_booth" | "rehearsal_room";

export type NetworkingMatchStatus = "matched" | "in_call" | "completed" | "skipped" | "reported" | "expired" | "cancelled";

export interface Agency {
  id: ID;
  name: string;
  slug: string;
  ownerUserId: ID;
  status: "active" | "paused" | "archived";
}

export interface AgencyMember {
  id: ID;
  agencyId: ID;
  userId: ID;
  role: string;
  status: "active" | "invited" | "disabled";
}

export interface Client {
  id: ID;
  agencyId: ID;
  name: string;
  slug: string;
  industry: string;
  status: "active" | "prospect" | "paused" | "archived";
  primaryContactName: string;
  primaryContactEmail: string;
  logoUrl?: string;
}

export interface Event {
  id: ID;
  agencyId: ID;
  clientId: ID;
  name: string;
  slug: string;
  eventType: EventType;
  status: EventStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  description: string;
  internalGoal: string;
  clientFacingGoal: string;
  primaryProducerUserId: ID;
  projectManagerUserId: ID;
  registrationEnabled: boolean;
  venueEnabled: boolean;
  replayEnabled: boolean;
  reportingEnabled: boolean;
}

export interface EventTemplate {
  id: ID;
  agencyId: ID;
  name: string;
  eventType: EventType;
  description: string;
  defaultDurationMinutes: number;
  defaultRooms: string[];
  defaultCrewRoles: string[];
}

export interface EventMilestone {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  title: string;
  status: "not_started" | "in_progress" | "blocked" | "complete" | "skipped";
  dueAt: string;
  clientVisible: boolean;
}

export interface ProductionTask {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  milestoneId?: ID;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToUserId?: ID;
  assignedRole?: string;
  dueAt: string;
  clientVisible: boolean;
  linkedResourceType?: string;
  linkedResourceId?: string;
}

export interface RunOfShowSegment {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  segmentTitle: string;
  publicTitle: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  room: string;
  speakerId?: ID;
  sponsorId?: ID;
  responsibleUserId?: ID;
  producerNotes: string;
  technicalCues: string;
  clientFacingDescription: string;
  backupPlan: string;
  pollCue?: string;
  qAndACue?: string;
  sponsorMention?: string;
  /** A networking block: guests get the link to the networking queue on its row. Set by the producer. */
  networking?: boolean;
  readinessStatus: "not_started" | "needs_assets" | "needs_speaker" | "needs_approval" | "ready" | "at_risk" | "blocked";
  approvalStatus: ApprovalStatus;
  clientVisible: boolean;
}

export interface Contractor {
  id: ID;
  agencyId: ID;
  userId?: ID;
  name: string;
  email: string;
  timezone: string;
  primaryRole: string;
  skills: string[];
  rateType: "hourly" | "flat_event" | "daily" | "retainer" | "unknown";
  rateAmount?: number;
  status: "active" | "inactive" | "prospect" | "blocked" | "archived";
}

export interface ContractorAssignment {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  contractorId: ID;
  userId?: ID;
  role: string;
  status: "invited" | "confirmed" | "declined" | "active" | "completed" | "cancelled";
  callTimeAt: string;
  sharedNotes: string;
  assignedTaskIds: ID[];
  assignedRunOfShowSegmentIds: ID[];
}

export interface Vendor {
  id: ID;
  agencyId: ID;
  name: string;
  serviceCategory: string;
  primaryContactName: string;
  primaryContactEmail: string;
  status: "active" | "inactive" | "prospect" | "archived";
}

export interface VendorAssignment {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  vendorId: ID;
  serviceCategory: string;
  status: "requested" | "confirmed" | "in_progress" | "waiting_on_vendor" | "complete" | "cancelled";
  dueAt: string;
  sharedNotes: string;
}

export interface SpeakerProfile {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  userId?: ID;
  name: string;
  title: string;
  company: string;
  email: string;
  bio: string;
  readinessStatus: SpeakerReadinessStatus;
  techCheckStatus: "not_scheduled" | "scheduled" | "completed" | "failed" | "waived";
  sessionTitle: string;
}

export interface Sponsor {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  name: string;
  websiteUrl: string;
  tier: "title" | "platinum" | "gold" | "silver" | "community" | "custom";
  status: SponsorReadinessStatus;
  primaryContactName: string;
  primaryContactEmail: string;
}

export interface SponsorBooth {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  sponsorId: ID;
  name: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  offerText: string;
  status: "draft" | "needs_assets" | "submitted" | "agency_review" | "client_review" | "approved" | "live" | "archived";
  approvalStatus: ApprovalStatus;
  leadCount: number;
  resourceCount: number;
}

export interface Asset {
  id: ID;
  agencyId: ID;
  clientId?: ID;
  eventId?: ID;
  ownerUserId?: ID;
  assetType: string;
  name: string;
  status: AssetStatus;
  visibility: "internal_agency" | "client_facing" | "crew_limited" | "speaker_limited" | "sponsor_limited" | "attendee_facing";
  linkedResourceType?: string;
  linkedResourceId?: string;
}

export interface ApprovalRequest {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  approvalType: string;
  title: string;
  description: string;
  status: ApprovalStatus;
  resourceType: string;
  resourceId: ID;
  assignedToUserId?: ID;
  dueAt: string;
  clientVisible: boolean;
  locked: boolean;
}

export interface VideoRoom {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  roomType: VideoRoomType;
  resourceType: string;
  resourceId: ID;
  provider: "mock" | "livekit" | "daily" | "agora" | "mux" | "twilio" | "other";
  providerRoomId?: string;
  name: string;
  status: VideoRoomStatus;
  recordingEnabled: boolean;
}

export interface NetworkingMatch {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  attendeeOneId: ID;
  attendeeTwoId: ID;
  videoRoomId?: ID;
  status: NetworkingMatchStatus;
  startedAt?: string;
  endedAt?: string;
}

export interface AnalyticsEvent {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  userId?: ID;
  attendeeId?: ID;
  eventName: string;
  resourceType?: string;
  resourceId?: ID;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface AuditLog {
  id: ID;
  agencyId: ID;
  clientId?: ID;
  eventId?: ID;
  actorUserId: ID;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: ID;
  createdAt: string;
  visibility: "internal_agency" | "client_visible_summary" | "system_only";
}

export interface Attendee {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  userId?: ID;
  name: string;
  email: string;
  company: string;
  title: string;
  website?: string;
  socialLinks?: string[];
  reasonForAttending?: string;
  interestingFact?: string;
  networkingEnabled: boolean;
  status: "registered" | "checked_in" | "active" | "blocked" | "removed";
}

export interface Session {
  id: ID;
  agencyId: ID;
  clientId: ID;
  eventId: ID;
  name: string;
  description: string;
  sessionType: "breakout" | "workshop" | "panel" | "roundtable" | "sponsor_session" | "rehearsal";
  status: "draft" | "scheduled" | "open" | "live" | "ended" | "cancelled" | "replay_ready";
  startAt: string;
  endAt: string;
  capacity: number;
}

export interface MockData {
  agencies: Agency[];
  agencyMembers: AgencyMember[];
  clients: Client[];
  events: Event[];
  eventTemplates: EventTemplate[];
  milestones: EventMilestone[];
  tasks: ProductionTask[];
  runOfShowSegments: RunOfShowSegment[];
  contractors: Contractor[];
  contractorAssignments: ContractorAssignment[];
  vendors: Vendor[];
  vendorAssignments: VendorAssignment[];
  speakers: SpeakerProfile[];
  sponsors: Sponsor[];
  sponsorBooths: SponsorBooth[];
  assets: Asset[];
  approvals: ApprovalRequest[];
  videoRooms: VideoRoom[];
  networkingMatches: NetworkingMatch[];
  analyticsEvents: AnalyticsEvent[];
  auditLogs: AuditLog[];
  attendees: Attendee[];
  sessions: Session[];
}
