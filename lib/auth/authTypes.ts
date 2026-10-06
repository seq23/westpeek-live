import type { PermissionUser, ScopeType, UserRole } from "@/types/permissions";

export interface AuthSession {
  user: PermissionUser;
  source: "mock" | "password";
}

export interface AuthCookiePayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  timezone?: string | null;
  status: string;
}

export interface RoleAssignmentRecord {
  id: string;
  user_id: string;
  role: UserRole | string;
  scope_type: ScopeType | string;
  scope_id?: string | null;
  agency_id?: string | null;
  client_id?: string | null;
  event_id?: string | null;
  status: string;
}

export interface AgencyMemberRecord {
  id: string;
  agency_id: string;
  user_id: string;
  role: UserRole | string;
  status: string;
}

export interface ClientContactRecord {
  id: string;
  client_id: string;
  user_id?: string | null;
  role: UserRole | string;
  status: string;
}

export interface AuthAccessSnapshot {
  profile: ProfileRecord;
  agencyMembers: AgencyMemberRecord[];
  roleAssignments: RoleAssignmentRecord[];
  clientContacts: ClientContactRecord[];
  contractorAssignmentIds: string[];
  vendorAssignmentIds: string[];
  speakerProfileIds: string[];
  sponsorIds: string[];
  eventIds: string[];
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthRequiredError";
  }
}

export class PermissionDeniedError extends Error {
  constructor(action: string) {
    super(`Permission denied for action: ${action}`);
    this.name = "PermissionDeniedError";
  }
}
