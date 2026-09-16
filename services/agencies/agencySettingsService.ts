import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { RuntimeSchemaMissingError, type AgencyMemberEntry, type AgencySettingsRecord } from "@/types/runtimeEvent";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

export const AGENCY_SETTINGS_ID = "west-peek";

/** West Peek brand system defaults (WEST_PEEK_BRAND_SYSTEM.md): black ink, signature orange. */
export const DEFAULT_AGENCY_SETTINGS: AgencySettingsRecord = {
  id: AGENCY_SETTINGS_ID,
  agencyName: "West Peek",
  primaryColor: "#050505",
  accentColor: "#F05A1A",
  members: [{ name: "Sequoia Taylor", email: "", role: "owner" }],
  updatedBy: "default",
  updatedByLabel: "Repo default",
  updatedAt: "2026-09-15T00:00:00.000Z",
};

export async function getAgencySettings(): Promise<AgencySettingsRecord> {
  try {
    return (await getRuntimeStore().getAgencySettings(AGENCY_SETTINGS_ID)) || DEFAULT_AGENCY_SETTINGS;
  } catch (error) {
    if (error instanceof RuntimeSchemaMissingError) return DEFAULT_AGENCY_SETTINGS;
    throw error;
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function saveAgencySettings(input: { agencyName: string; primaryColor: string; accentColor: string; members: AgencyMemberEntry[] }, actor: WorkspaceActor) {
  const agencyName = input.agencyName.trim();
  if (!agencyName) throw new Error("Agency name is required.");
  if (!HEX.test(input.primaryColor.trim()) || !HEX.test(input.accentColor.trim())) throw new Error("Colours must be 6-digit hex values like #FF5A1F.");
  const members = input.members.map((member) => ({ name: member.name.trim(), email: member.email.trim(), role: member.role.trim() || "member" })).filter((member) => member.name || member.email);
  const record: AgencySettingsRecord = {
    id: AGENCY_SETTINGS_ID,
    agencyName,
    primaryColor: input.primaryColor.trim().toUpperCase(),
    accentColor: input.accentColor.trim().toUpperCase(),
    members,
    updatedBy: actor.id,
    updatedByLabel: actor.label,
    updatedAt: new Date().toISOString(),
  };
  return getRuntimeStore().setAgencySettings(record);
}
