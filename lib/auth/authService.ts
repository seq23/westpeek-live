import { getDbClient } from "@/lib/d1/binding";
import type { PermissionUser } from "@/types/permissions";
import type {
  AgencyMemberRecord,
  AuthAccessSnapshot,
  ClientContactRecord,
  ProfileRecord,
  RoleAssignmentRecord,
} from "./authTypes";
import { resolvePermissionUser } from "./accessResolver";

async function selectByUserId<T>(table: string, userId: string, select = "*"): Promise<T[]> {
  const { data, error } = await getDbClient().from(table).select(select).eq("user_id", userId).eq("status", "active");

  if (error) throw new Error(`Failed to resolve ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function getProfileByUserId(userId: string): Promise<ProfileRecord | null> {
  const { data, error } = await getDbClient().from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) throw new Error(`Failed to resolve profile: ${error.message}`);
  return (data ?? null) as ProfileRecord | null;
}

export async function resolveAccessSnapshot(userId: string): Promise<AuthAccessSnapshot | null> {
  const profile = await getProfileByUserId(userId);
  if (!profile || profile.status !== "active") return null;

  const [agencyMembers, roleAssignments, clientContacts, contractorAssignments, vendorAssignments, speakerProfiles, sponsors] = await Promise.all([
    selectByUserId<AgencyMemberRecord>("agency_members", userId),
    selectByUserId<RoleAssignmentRecord>("role_assignments", userId),
    selectByUserId<ClientContactRecord>("client_contacts", userId),
    selectByUserId<{ id: string; event_id: string }>("contractor_assignments", userId),
    selectByUserId<{ id: string; event_id: string }>("vendor_assignments", userId),
    selectByUserId<{ id: string; event_id: string }>("speaker_profiles", userId),
    selectByUserId<{ id: string; event_id: string }>("sponsors", userId),
  ]);

  return {
    profile,
    agencyMembers,
    roleAssignments,
    clientContacts,
    contractorAssignmentIds: contractorAssignments.map((assignment) => assignment.id),
    vendorAssignmentIds: vendorAssignments.map((assignment) => assignment.id),
    speakerProfileIds: speakerProfiles.map((speaker) => speaker.id),
    sponsorIds: sponsors.map((sponsor) => sponsor.id),
    eventIds: [
      ...contractorAssignments.map((assignment) => assignment.event_id),
      ...vendorAssignments.map((assignment) => assignment.event_id),
      ...speakerProfiles.map((speaker) => speaker.event_id),
      ...sponsors.map((sponsor) => sponsor.event_id),
    ],
  };
}

export async function resolvePermissionUserForUserId(userId: string): Promise<PermissionUser | null> {
  const snapshot = await resolveAccessSnapshot(userId);
  if (!snapshot) return null;
  return resolvePermissionUser(snapshot);
}
