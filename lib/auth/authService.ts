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

async function selectByUserId<T>(table: string, userId: string, options: { activeOnly?: boolean } = {}): Promise<T[]> {
  let query = getDbClient().from(table).select("*").eq("user_id", userId);
  if (options.activeOnly !== false) query = query.eq("status", "active");
  const { data, error } = await query;

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

  // vendor_assignments and sponsors carry no user_id, and speaker_profiles has no status column:
  // the Postgres-era version asked for those columns anyway, so EVERY self-serve user's resolution
  // threw (found 6 Oct 2026 on the D1 move). A vendor or sponsor is not a login; they contribute none.
  const vendorAssignments: Array<{ id: string; event_id: string }> = [];
  const sponsors: Array<{ id: string; event_id: string }> = [];
  const [agencyMembers, roleAssignments, clientContacts, contractorAssignments, speakerProfiles] = await Promise.all([
    selectByUserId<AgencyMemberRecord>("agency_members", userId),
    selectByUserId<RoleAssignmentRecord>("role_assignments", userId),
    selectByUserId<ClientContactRecord>("client_contacts", userId),
    selectByUserId<{ id: string; event_id: string }>("contractor_assignments", userId),
    selectByUserId<{ id: string; event_id: string }>("speaker_profiles", userId, { activeOnly: false }),
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
