import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { canOperatorAccessPath, canOwnerAccessPath } from "@/lib/auth/v5RouteAuthorization";
import { isWorkspaceMember, NO_WORKSPACE_PATH } from "@/lib/auth/workspaceMembership";

export default async function AgencyAppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  // A signed-in account is not a workspace: only an active agency member's session is (workspaceMembership.ts).
  if (!isWorkspaceMember(user)) {
    const env = getEnv();
    const { operatorCookieName, ownerCookieName } = getV5AccessCookieNames(env);
    const ownerCookie = (await cookies()).get(ownerCookieName)?.value;
    const ownerPayload = ownerCookie ? await readV5AccessCookie(ownerCookie, getV5AccessCookieSecret(env)) : null;
    const ownerCanEnterApp = canOwnerAccessPath("/app", ownerPayload || undefined);

    const operatorCookie = (await cookies()).get(operatorCookieName)?.value;
    const operatorPayload = operatorCookie ? await readV5AccessCookie(operatorCookie, getV5AccessCookieSecret(env)) : null;
    const operatorCanEnterDay1App = canOperatorAccessPath("/app/events/new", operatorPayload || undefined);

    if (!ownerCanEnterApp && !operatorCanEnterDay1App) redirect(user ? NO_WORKSPACE_PATH : "/login?next=/app");
  }

  return <AppShell>{children}</AppShell>;
}
