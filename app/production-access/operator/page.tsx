import { LegalFooter } from "@/components/legal/LegalFooter";
import { GateExit } from "@/components/access/GateExit";
import { GateRefusalNotice } from "@/components/access/GateRefusalNotice";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { WestPeekProductionsLogoHomeLink } from "@/components/brand/WestPeekProductionsLogo";
import { BrandedSetupError } from "@/components/system/BrandedSetupError";
import { accessDefaultLines, missingAccessEnv } from "@/lib/env/safeEnv";
import { alreadyAuthorisedDestination } from "@/lib/auth/ownerNeverEntersACode";

export default async function OperatorAccessPage({ searchParams }: { searchParams?: Promise<{ error?: string; retry?: string; next?: string }> }) {
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
        <form action="/api/production-access/operator" method="post" className="mt-6 space-y-5">
          <input type="hidden" name="next" value={resolvedSearchParams?.next || "/production-access/launchpad"} />
          <div>
            <label htmlFor="operator-password" className="text-sm font-black">Operator launchpad password <span className="text-brand-orange">*</span></label>
            <p className="mt-1 text-xs text-brand-muted">This comes from OPERATOR_LAUNCHPAD_PASSWORD and must be different from CREW_ACCESS_PASSWORD.</p>
            <input id="operator-password" name="password" type="password" required className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
          </div>
          <button className="w-full rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Enter Operator Launchpad</button>
        </form>
        <GateRefusalNotice error={resolvedSearchParams?.error} retry={resolvedSearchParams?.retry} />
        {resolvedSearchParams?.error === "invalid" ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">That operator password did not match. Use the operator launchpad password, not the crew password.</p> : null}
        <GateExit next={resolvedSearchParams?.next} />
      </section>
      </main>
      <LegalFooter variant="compact" />
    </>
  );
}
