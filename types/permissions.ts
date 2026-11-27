export type UserRole =
  | "agency_owner"
  | "agency_admin"
  | "executive_producer"
  | "producer"
  | "project_manager"
  | "technical_director"
  | "moderator"
  | "contractor"
  | "vendor"
  | "client_owner"
  | "client_reviewer"
  | "speaker"
  | "sponsor_admin"
  | "sponsor_representative"
  | "attendee"
  | "finance";

export type ScopeType = "platform" | "agency" | "client" | "event" | "own_record";

export interface PermissionUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  agencyIds: string[];
  /**
   * Agencies this person is an ACTIVE member of (agency_members only, never a role assignment). Only
   * a member gets the /app workspace (lib/auth/workspaceMembership.ts); missing means not a member.
   */
  agencyMemberships?: string[];
  clientIds?: string[];
  eventIds?: string[];
  contractorAssignmentIds?: string[];
  vendorAssignmentIds?: string[];
  speakerProfileIds?: string[];
  sponsorIds?: string[];
  attendeeIds?: string[];
}

export interface PermissionResource {
  id: string;
  agencyId?: string;
  clientId?: string;
  eventId?: string;
  ownerUserId?: string;
  assignedUserIds?: string[];
  contractorAssignmentId?: string;
  vendorAssignmentId?: string;
  speakerProfileId?: string;
  sponsorId?: string;
  attendeeId?: string;
  visibility?: "internal_agency" | "client_facing" | "crew_limited" | "speaker_limited" | "sponsor_limited" | "attendee_facing";
  clientVisible?: boolean;
  locked?: boolean;
}
