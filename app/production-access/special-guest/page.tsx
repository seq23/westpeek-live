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
import { resolveSpecialGuestAccess } from "@/services/access/eventAccessResolver";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { grantOwnerOverrideIfMatched } from "@/lib/auth/ownerAccessOverride";
import type { V4SpecialGuestRole } from "@/types/v4";
import { getAccessCodeVersions } from "@/services/events/accessCodeService";

// Day 1 special guest defaults are registry-managed; do not display or hardcode role codes here.
async function enterGuest(formData: FormData) {
  "use server";
  if (missingAccessEnv().includes("V5_ACCESS_COOKIE_SECRET")) redirect("/production-access/setup-error");
  const eventCode = String(formData.get("eventCode") ?? "");
  const roleCode = String(formData.get("roleCode") ?? "");
  // The owner master password here lands on "Preview a guest" for the typed event code, not the workspace.
  await grantOwnerOverrideIfMatched({ password: roleCode, route: "/production-access/special-guest", next: `/production-access/special-guest/preview?event=${encodeURIComponent(eventCode)}` });
  const access = await resolveSpecialGuestAccess(eventCode, roleCode);
  if (!access.ok || !access.destination || !access.eventId || !access.role) {
    await logAccessAttempt({ status: "access_denied", accessKind: "special_guest", eventId: access.eventId, role: String(access.role || "unknown"), reason: access.reason, route: "/production-access/special-guest" });
    redirect(`/production-access/special-guest?error=${access.reason ?? "invalid"}`);
  }
  const env = getEnv();
  const { specialGuestCookieName } = getV5AccessCookieNames(env);
  const role = access.role as V4SpecialGuestRole;
  await logAccessAttempt({ status: "access_granted", accessKind: "special_guest", eventId: access.eventId, role, route: access.destination });
  // The cookie remembers the code version it was minted at; changing the code sends it back here.
  const codeVersion = role === "crew_lite" ? undefined : (await getAccessCodeVersions(access.eventId))[role];
  const cookie = await createV5AccessCookie({ kind: "special_guest", eventId: access.eventId, clientSlug: access.clientSlug, role, codeVersion, issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 12 }, getV5AccessCookieSecret(env));
  (await cookies()).set(specialGuestCookieName, cookie, getV5CookieOptions(60 * 60 * 12));
  redirect(access.destination);
}

/** `?event=<code>&code=<role code>` PREFILLS the form (a guest link the crew copied); the guest still presses Continue. */
export default async function SpecialGuestAccessPage({ searchParams }: { searchParams?: Promise<{ error?: string; retry?: string; next?: string; event?: string; code?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const prefilledEvent = String(resolvedSearchParams?.event || "").trim().slice(0, 80);
  const prefilledCode = String(resolvedSearchParams?.code || "").trim().slice(0, 120);
  const missing = missingAccessEnv().filter((item) => item === "V5_ACCESS_COOKIE_SECRET");
  if (missing.length) return <BrandedSetupError title="Special guest access is not configured yet." message="Special guest login needs a cookie secret to create role-scoped access cookies. This page now fails safely with setup instructions instead of throwing a server digest page." missingVariables={missing} defaultValues={accessDefaultLines()} />;
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogo size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Special guest gate</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Client, speaker, sponsor, crew-lite, or VIP</h1>
        <p className="mt-4 text-sm leading-6 text-brand-muted">Enter the event code and your role-scoped access password from production. For real events, create these in Event Setup → Access.</p>
        <div className="mt-5 rounded-2xl bg-brand-ash p-4 text-sm leading-6 text-brand-muted">
          <p className="font-black text-brand-black">Day 1 access</p>
          <p>Use the role-scoped password from the Day 1 Operator Packet or your secure production vault. This public gate never displays speaker, sponsor, VIP, or client passwords.</p>
        </div>
        <form action={enterGuest} className="mt-6 space-y-5">
          <input type="hidden" name="next" value={resolvedSearchParams?.next || "/app"} />
          <div>
            <label htmlFor="special-event-code" className="text-sm font-black">Event code <span className="text-brand-orange">*</span></label>
            <p className="mt-1 text-xs text-brand-muted">Use the event code from your production contact. For the demo, use demo.</p>
            <input id="special-event-code" name="eventCode" required defaultValue={prefilledEvent} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
          </div>
          <div>
            <label htmlFor="special-role-code" className="text-sm font-black">Special guest password <span className="text-brand-orange">*</span></label>
            <p className="mt-1 text-xs text-brand-muted">Use your speaker, sponsor, client, crew-lite, or VIP password.</p>
            <input id="special-role-code" name="roleCode" required defaultValue={prefilledCode} className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" data-prefilled={prefilledCode ? "true" : "false"} />
            {prefilledCode ? <p className="mt-1 text-xs font-bold text-emerald-800" data-testid="guest-code-prefilled">Your code is filled in from your link. Press Continue.</p> : null}
          </div>
          <button className="w-full rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Continue to assigned portal</button>
        </form>
        {resolvedSearchParams?.error === "too_many" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800" data-testid="gate-too-many">Too many wrong codes from here. Wait about {resolvedSearchParams?.retry || "60"} seconds and try again — the invitation link fills the code in for you.</p> : resolvedSearchParams?.error === "rotated" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800" data-testid="guest-code-rotated">That code was changed by the production team. Ask them for the new link.</p> : resolvedSearchParams?.error ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">That access code did not match a speaker, sponsor, client, or VIP access group for this event.</p> : null}
        <GateExit next={resolvedSearchParams?.next} />
      </section>
      </main>
      <LegalFooter variant="compact" />
    </>
  );
}
