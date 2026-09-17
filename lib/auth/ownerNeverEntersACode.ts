import { cookies } from "next/headers";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { canOperatorAccessPath, canOwnerAccessPath } from "@/lib/auth/v5RouteAuthorization";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { commandBarVisibleTo } from "@/lib/navigation/eventCommandSurfaces";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";

/**
 * Half of the one rule the owner asked for (plan §2.5, §2.6):
 *
 *   **An owner holding the master key never needs to enter a code.**
 *
 * The rule kept being broken in the same two shapes, so both live here as one implementation that
 * every page asks, rather than four pages each remembering it:
 *
 * 1. A page belonging to a guest role bounced the owner to a code gate because a GUEST cookie they
 *    happen to also hold went stale. The owner's master key was never consulted. That is the
 *    "every time I click open it gives me another gate" the owner reported on 16 Sep 2026.
 *
 * 2. A code gate they landed on asked for a password to reach a destination their existing cookie
 *    already opens. The owner and operator gates each grew their own fix for this; the crew and
 *    special-guest gates never got one.
 *
 * The predicate is `commandBarVisibleTo`, the same one the Event Command Bar asks, so "who holds
 * the master key" is decided in one place and cannot drift between the bar and the gates.
 */
export async function holdsMasterKey(eventId?: string): Promise<boolean> {
  try {
    return commandBarVisibleTo(await getCrewViewer(eventId));
  } catch {
    // A cookie read that throws is not a master key. Fail closed: the guest keeps their gate.
    return false;
  }
}

/**
 * The destination a cookie the visitor ALREADY holds can open, or undefined when they must use the
 * form. Only a `next` the cookie genuinely authorises is honoured — an unknown or unauthorised
 * destination falls through to the gate rather than being waved past it.
 *
 * With no `next` at all there is nothing to pass through to, so the form renders: an owner who
 * opened a gate deliberately (to mint a crew cookie and see what crew see) still can.
 */
export async function alreadyAuthorisedDestination(next: string | undefined, fallback?: string): Promise<string | undefined> {
  const candidate = next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
  if (!candidate) return undefined;
  try {
    const env = getEnv();
    const { operatorCookieName, ownerCookieName } = getV5AccessCookieNames(env);
    const secret = getV5AccessCookieSecret(env);
    const cookieStore = await cookies();
    const owner = await readV5AccessCookie(cookieStore.get(ownerCookieName)?.value, secret);
    if (owner?.kind === "owner" && canOwnerAccessPath(candidate, owner)) return candidate;
    const operator = await readV5AccessCookie(cookieStore.get(operatorCookieName)?.value, secret);
    if (operator?.kind === "operator" && canOperatorAccessPath(candidate, operator)) return candidate;
  } catch {
    // Missing access configuration renders the gate's own setup error instead.
  }
  return undefined;
}
