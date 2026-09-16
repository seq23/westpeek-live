import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";

/**
 * Who is acting inside the /app workspace.
 *
 * The owner enters with the owner master password, which sets the signed owner
 * cookie. That cookie is the identity for every server action the owner runs;
 * no Supabase Auth session is required anywhere on the owner's path. A real
 * Supabase session (future staff) is still accepted, and an operator cookie is
 * accepted for the surfaces the operator gate already opens.
 */
export type WorkspaceActor =
  | { kind: "owner"; id: "owner"; label: string; role: "owner" }
  | { kind: "user"; id: string; label: string; role: string }
  | { kind: "operator"; id: "operator"; label: string; role: string };

export const OWNER_ACTOR_LABEL = "Sequoia Taylor / owner";

export class WorkspaceActorRequiredError extends Error {
  constructor() {
    super("Owner access, operator access, or a signed-in workspace session is required.");
    this.name = "WorkspaceActorRequiredError";
  }
}

export async function getWorkspaceActor(): Promise<WorkspaceActor | null> {
  try {
    const env = getEnv();
    const { ownerCookieName, operatorCookieName } = getV5AccessCookieNames(env);
    const secret = getV5AccessCookieSecret(env);
    const cookieStore = await cookies();
    const owner = await readV5AccessCookie(cookieStore.get(ownerCookieName)?.value, secret);
    if (owner?.kind === "owner") return { kind: "owner", id: "owner", label: OWNER_ACTOR_LABEL, role: "owner" };

    const user = await getCurrentUser();
    if (user) return { kind: "user", id: user.id, label: user.name || user.email, role: user.roles[0] || "agency_member" };

    const operator = await readV5AccessCookie(cookieStore.get(operatorCookieName)?.value, secret);
    if (operator?.kind === "operator") return { kind: "operator", id: "operator", label: "Operator", role: operator.role || "executive_producer" };
  } catch {
    // Missing cookie configuration must never crash a page; the caller decides what an anonymous request may do.
  }
  return null;
}

export async function requireWorkspaceActor(): Promise<WorkspaceActor> {
  const actor = await getWorkspaceActor();
  if (!actor) throw new WorkspaceActorRequiredError();
  return actor;
}
