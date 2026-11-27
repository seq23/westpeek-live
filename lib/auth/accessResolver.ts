import type { PermissionUser, UserRole } from "@/types/permissions";
import type { AuthAccessSnapshot } from "./authTypes";

const knownRoles: UserRole[] = [
  "agency_owner",
  "agency_admin",
  "executive_producer",
  "producer",
  "project_manager",
  "technical_director",
  "moderator",
  "contractor",
  "vendor",
  "client_owner",
  "client_reviewer",
  "speaker",
  "sponsor_admin",
  "sponsor_representative",
  "attendee",
  "finance",
];

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeRole(role: string): UserRole | null {
  return knownRoles.includes(role as UserRole) ? (role as UserRole) : null;
}

export function resolvePermissionUser(snapshot: AuthAccessSnapshot): PermissionUser {
  const membershipRoles = snapshot.agencyMembers.map((member) => normalizeRole(member.role)).filter(Boolean) as UserRole[];
  const assignmentRoles = snapshot.roleAssignments.map((assignment) => normalizeRole(assignment.role)).filter(Boolean) as UserRole[];
  const clientRoles = snapshot.clientContacts.map((contact) => normalizeRole(contact.role)).filter(Boolean) as UserRole[];

  const agencyIds = unique([
    ...snapshot.agencyMembers.map((member) => member.agency_id),
    ...snapshot.roleAssignments.map((assignment) => assignment.agency_id),
  ]);

  const clientIds = unique([
    ...snapshot.clientContacts.map((contact) => contact.client_id),
    ...snapshot.roleAssignments.map((assignment) => assignment.client_id),
  ]);

  const eventIds = unique([
    ...snapshot.eventIds,
    ...snapshot.roleAssignments.map((assignment) => assignment.event_id),
  ]);

  return {
    id: snapshot.profile.id,
    name: snapshot.profile.full_name,
    email: snapshot.profile.email,
    roles: unique([...membershipRoles, ...assignmentRoles, ...clientRoles]) as UserRole[],
    agencyIds,
    // selectByUserId reads active rows only, so this is the agencies she or he really belongs to.
    agencyMemberships: unique(snapshot.agencyMembers.map((member) => member.agency_id)),
    clientIds,
    eventIds,
    contractorAssignmentIds: snapshot.contractorAssignmentIds,
    vendorAssignmentIds: snapshot.vendorAssignmentIds,
    speakerProfileIds: snapshot.speakerProfileIds,
    sponsorIds: snapshot.sponsorIds,
  };
}
