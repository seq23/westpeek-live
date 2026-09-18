import { LegalFooter } from "@/components/legal/LegalFooter";
import { GateExit } from "@/components/access/GateExit";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WestPeekProductionsLogoHomeLink } from "@/components/brand/WestPeekProductionsLogo";
import { BrandedSetupError } from "@/components/system/BrandedSetupError";
import { accessDefaultLines, missingAccessEnv } from "@/lib/env/safeEnv";
import { assertSeparatedProductionPasswords, getEnv, getOperatorLaunchpadPassword, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { createV5AccessCookie, getV5CookieOptions } from "@/lib/auth/productionAccess";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { grantOwnerOverrideIfMatched } from "@/lib/auth/ownerAccessOverride";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { alreadyAuthorisedDestination } from "@/lib/auth/ownerNeverEntersACode";

async function enterOperator(formData: FormData) {
  "use server";
  if (missingAccessEnv().length) redirect("/production-access/setup-error");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/production-access/launchpad");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/production-access/launchpad";
  const env = getEnv();
  assertSeparatedProductionPasswords(env);
  await grantOwnerOverrideIfMatched({ password, route: "/production-access/operator", next: safeNext });
  if (!password || password !== getOperatorLaunchpadPassword(env)) {
    await logAccessAttempt({ status: "access_denied", accessKind: "operator", role: "executive_producer", reason: "invalid_password", route: "/production-access/operator" });
    redirect("/production-access/operator?error=invalid");
  }
  await logAccessAttempt({ status: "access_granted", accessKind: "operator", eventId: "event-summit", role: "executive_producer", route: safeNext });
  const { operatorCookieName } = getV5AccessCookieNames(env);
  const cookie = await createV5AccessCookie({ kind: "operator", role: "executive_producer", issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 8 }, getV5AccessCookieSecret(env));
  (await cookies()).set(operatorCookieName, cookie, getV5CookieOptions(60 * 60 * 8));
  redirect(safeNext);
}

export default async function OperatorAccessPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const missing = missingAccessEnv();
  if (missing.length) return <BrandedSetupError title="Operator access is not configured yet." message="The launchpad uses a separate high-trust operator password so crew access never unlocks admin diagnostics by accident." missingVariables={missing} defaultValues={accessDefaultLines()} />;
  if (!resolvedSearchParams?.error) {
    const destination = await alreadyAuthorisedDestination(resolvedSearchParams?.next, "/production-access/launchpad");
    if (destination) redirect(destination);
  }
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogoHomeLink size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Operator gate</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Operator Launchpad access</h1>
        <p className="mt-4 text-sm leading-6 text-brand-muted">Use the separate operator launchpad password from the Day 1 Operator Packet or your secure production vault. This public gate never displays the password.</p>
        <form action={enterOperator} className="mt-6 space-y-5">
          <input type="hidden" name="next" value={resolvedSearchParams?.next || "/production-access/launchpad"} />
          <div>
            <label htmlFor="operator-password" className="text-sm font-black">Operator launchpad password <span className="text-brand-orange">*</span></label>
            <p className="mt-1 text-xs text-brand-muted">This comes from OPERATOR_LAUNCHPAD_PASSWORD and must be different from CREW_ACCESS_PASSWORD.</p>
            <input id="operator-password" name="password" type="password" required className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
          </div>
          <button className="w-full rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Enter Operator Launchpad</button>
        </form>
        {resolvedSearchParams?.error === "invalid" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">That operator password did not match. Use the operator launchpad password, not the crew password.</p> : null}
        <GateExit next={resolvedSearchParams?.next} />
      </section>
      </main>
      <LegalFooter variant="compact" />
    </>
  );
}
