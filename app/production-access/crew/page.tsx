import { LegalFooter } from "@/components/legal/LegalFooter";
import { GateExit } from "@/components/access/GateExit";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { BrandedSetupError } from "@/components/system/BrandedSetupError";
import { accessDefaultLines, missingAccessEnv } from "@/lib/env/safeEnv";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { resolveCrewAccess } from "@/services/access/eventAccessResolver";
import { SupersededGateNotice, supersededGateQuery } from "@/components/access/SupersededGateNotice";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { grantOwnerOverrideIfMatched } from "@/lib/auth/ownerAccessOverride";
import { alreadyAuthorisedDestination } from "@/lib/auth/ownerNeverEntersACode";
import type { V4CrewRole } from "@/types/v4";
import { CREW_ROLES, crewRoleDescriptions, crewRoleLabels } from "@/lib/auth/crewRolePermissions";
import { getHostLinkState } from "@/services/events/hostLinkService";
import { getCrewAccessPassword } from "@/lib/env";

// Day 1 access defaults are registry-managed; do not display or hardcode human passwords here.
// Every role in the permission map can be chosen here: crew, executive_producer (the host), producer,
// technical_director, show_caller, moderator, va, support — each described under the select.
function normalizeCrewRole(value: FormDataEntryValue | null | undefined): V4CrewRole {
  const role = String(value || "crew");
  if (CREW_ROLES.includes(role as V4CrewRole)) return role as V4CrewRole;
  return "crew";
}

async function enterCrew(formData: FormData) {
  "use server";
  if (missingAccessEnv().length) redirect("/production-access/setup-error");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  const eventCode = String(formData.get("eventCode") ?? "");
  const crewRole = normalizeCrewRole(formData.get("crewRole"));
  const env = getEnv();

  await grantOwnerOverrideIfMatched({ password, route: "/production-access/crew", next: safeNext || (eventCode ? `/crew/events/${eventCode}` : "/crew/events/demo") });

  // The global crew password still opens every event; a runtime-created event's own crew code opens just that event.
  const access = await resolveCrewAccess(eventCode || undefined, crewRole, password || "");
  if (!access.ok) {
    await logAccessAttempt({ status: "access_denied", accessKind: "crew", eventId: access.eventId, role: crewRole, reason: access.reason || "invalid_password", route: "/production-access/crew" });
    const superseded = supersededGateQuery(access);
    redirect(superseded ? `/production-access/crew?${superseded}` : access.reason === "invalid_password" || !password ? "/production-access/crew?error=invalid" : "/production-access/crew?error=invalid_event");
  }
  await logAccessAttempt({ status: "access_granted", accessKind: "crew", eventId: access.eventId, role: access.role || crewRole, route: access.destination });
  const { crewCookieName } = getV5AccessCookieNames(env);
  // Entered with the event's own crew code (a host link): the cookie remembers the code version so revoking the link ends it.
  const viaEventCode = Boolean(access.eventId) && password !== (getCrewAccessPassword()?.trim() || "\u0000");
  const codeVersion = viaEventCode && access.eventId ? (await getHostLinkState(access.eventId)).codeVersion : undefined;
  const cookie = await createV5AccessCookie({ kind: "crew", eventId: access.eventId, role: crewRole, codeVersion, issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 8 }, getV5AccessCookieSecret(env));
  (await cookies()).set(crewCookieName, cookie, getV5CookieOptions(60 * 60 * 8));
  redirect(access.destination || `/crew/events/${access.eventId || "demo"}`);
}

/**
 * The gate accepts `?event=<code>&role=<crew role>&code=<crew code>` to PREFILL the form — a host link
 * the owner generated, or the "Switch role" link on a crew page. Nothing is submitted until the person
 * presses Enter crew workspace; the prefilled crew code is the event's own code, never the global password.
 */
export default async function CrewAccessPage({ searchParams }: { searchParams?: Promise<{ error?: string; retry?: string; next?: string; event?: string; role?: string; code?: string; codeField?: string; on?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const prefilledRole = normalizeCrewRole(resolvedSearchParams?.role);
  const prefilledEvent = String(resolvedSearchParams?.event || "").trim().slice(0, 80);
  const prefilledCode = String(resolvedSearchParams?.code || "").trim().slice(0, 120);
  const missing = missingAccessEnv();
  if (missing.length) return <BrandedSetupError title="Crew access is not configured yet." message="Crew login needs explicit access variables. This page now fails safely with setup instructions instead of throwing a server digest page." missingVariables={missing} defaultValues={accessDefaultLines()} />;
  // The master key never enters a code. An owner or operator whose cookie already opens the
  // destination they were sent here for goes straight there instead of meeting a second gate.
  if (!resolvedSearchParams?.error) {
    const destination = await alreadyAuthorisedDestination(resolvedSearchParams?.next);
    if (destination) redirect(destination);
  }
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogo size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Crew gate</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Crew workspace access</h1>
        <p className="mt-4 text-sm leading-6 text-brand-muted">Use the internal crew password from the Day 1 Operator Packet or your secure production vault, then choose the crew role you are operating as today. This public gate never displays the password.</p>
        <form action={enterCrew} className="mt-6 space-y-5">
          <input type="hidden" name="next" value={resolvedSearchParams?.next || ""} />
          <div>
            <label htmlFor="crew-password" className="text-sm font-black">Crew password <span className="text-brand-orange">*</span></label>
            <p className="mt-1 text-xs text-brand-muted">Use the internal crew password. In production, this comes from CREW_ACCESS_PASSWORD.</p>
            <input id="crew-password" name="password" type="password" required defaultValue={prefilledCode} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" data-prefilled={prefilledCode ? "true" : "false"} />
            {prefilledCode ? <p className="mt-1 text-xs font-bold text-emerald-800" data-testid="crew-code-prefilled">This event&rsquo;s crew code is filled in from your link. Press Enter crew workspace.</p> : null}
          </div>
          <div>
            <label htmlFor="crew-event-code" className="text-sm font-black">Event code</label>
            <p className="mt-1 text-xs text-brand-muted">Optional. Leave blank for the demo crew workspace, or enter an event code for event-specific crew routing.</p>
            <input id="crew-event-code" name="eventCode" defaultValue={prefilledEvent} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
          </div>
          <div>
            <label htmlFor="crew-role" className="text-sm font-black">Production role <span className="text-brand-orange">*</span></label>
            <p className="mt-1 text-xs text-brand-muted">Choose the role you are operating as today so permissions and UI guidance match your responsibilities.</p>
            <select id="crew-role" name="crewRole" defaultValue={prefilledRole} required className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" data-testid="crew-role-select">
              {CREW_ROLES.map((role) => <option key={role} value={role}>{crewRoleLabels[role]}</option>)}
            </select>
            <dl className="mt-3 grid gap-2 rounded-2xl bg-brand-ash p-4 text-xs leading-5 sm:grid-cols-2" data-testid="crew-role-descriptions">
              {CREW_ROLES.map((role) => (
                <div key={role} data-testid={`crew-role-description-${role}`}>
                  <dt className="font-black text-brand-black">{crewRoleLabels[role]}</dt>
                  <dd className="text-brand-muted">{crewRoleDescriptions[role]}</dd>
                </div>
              ))}
            </dl>
          </div>
          <button className="w-full rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Enter crew workspace</button>
        </form>
        {resolvedSearchParams?.error === "too_many" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800" data-testid="gate-too-many">Too many wrong codes from here. Wait about {resolvedSearchParams?.retry || "60"} seconds and try again — or ask the producer for the link, which fills the code in for you.</p> : null}
        {resolvedSearchParams?.error === "superseded" ? <SupersededGateNotice field={resolvedSearchParams?.codeField} replacedAt={resolvedSearchParams?.on} testId="crew-code-superseded" /> : null}
        {resolvedSearchParams?.error === "invalid" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">That crew password did not match. Check the Day 1 internal password or ask the operator/admin.</p> : null}
        {resolvedSearchParams?.error === "launchpad_required" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Enter the crew password first. The Operator Launchpad requires the separate operator password.</p> : null}
        {resolvedSearchParams?.error === "operator_packet_required" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Enter operator access first. The Operator Packet contains internal launchpad instructions and stays behind the operator gate.</p> : null}
        {resolvedSearchParams?.error === "invalid_event" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">That event code is not valid for crew routing. Leave it blank to enter the demo crew workspace.</p> : null}
        <GateExit next={resolvedSearchParams?.next} />
      </section>
      </main>
      <LegalFooter variant="compact" />
    </>
  );
}
