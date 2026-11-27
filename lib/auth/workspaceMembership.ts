import type { PermissionUser } from "@/types/permissions";

/**
 * WHO GETS THE /app WORKSPACE (security audit A row 2, 27 Nov 2026).
 *
 * Anyone can make an account at /signup, so an account proves only that someone typed an email and a
 * password. Before this, any live session opened /app and /admin: every event's people, the supplier
 * file, documents, settings and uploads. Now a self-serve session counts only when its person is an
 * ACTIVE member of an agency (an `agency_members` row, the membership the app already stores). An
 * account with no membership is sent to NO_WORKSPACE_PATH, which asks the person to be added. Nothing in
 * the app writes `agency_members` yet, so adding someone is a D1 row (see the PR's Not built).
 *
 * The owner and operator doors are separate signed cookies and are untouched by this.
 */
export const NO_WORKSPACE_PATH = "/no-workspace";

export function isWorkspaceMember(user: PermissionUser | null | undefined): boolean {
  return Boolean(user?.agencyMemberships?.length);
}
