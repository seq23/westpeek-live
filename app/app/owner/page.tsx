import { redirect } from "next/navigation";
import { OwnerConsole } from "@/components/owner/OwnerConsole";
import { SafeSection } from "@/components/system/SafeSection";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";

export const dynamic = "force-dynamic";

/** Where the owner master password lands: one organised home. Operators are sent to the launchpad. */
export default async function OwnerConsolePage() {
  const actor = await getWorkspaceActor();
  if (actor?.kind !== "owner") redirect(actor ? "/production-access/launchpad" : "/production-access/owner?next=%2Fapp%2Fowner");
  return <SafeSection label="Owner console" render={() => OwnerConsole()} />;
}
