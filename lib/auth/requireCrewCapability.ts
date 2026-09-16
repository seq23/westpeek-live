import { cookies } from "next/headers";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { assertCanPerformCrewAction } from "@/lib/auth/v5RouteAuthorization";

export async function requireCrewCapability(action: string, eventId?: string) {
  const env = getEnv();
  const names = getV5AccessCookieNames(env);
  const secret = getV5AccessCookieSecret(env);
  const cookieStore = await cookies();

  // Owner and operator cookies may do everything; only a crew cookie is checked against the role table.
  const ownerPayload = await readV5AccessCookie(cookieStore.get(names.ownerCookieName)?.value, secret);
  if (ownerPayload?.kind === "owner") return ownerPayload;
  const operatorPayload = await readV5AccessCookie(cookieStore.get(names.operatorCookieName)?.value, secret);
  if (operatorPayload?.kind === "operator" && (!eventId || !operatorPayload.eventId || operatorPayload.eventId === eventId)) return operatorPayload;

  const crewPayload = await readV5AccessCookie(cookieStore.get(names.crewCookieName)?.value, secret);
  assertCanPerformCrewAction(crewPayload, action, eventId);
  return crewPayload;
}
