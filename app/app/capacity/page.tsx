import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CapacityReadout } from "@/components/capacity/CapacityReadout";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { SafeSection } from "@/components/system/SafeSection";
import { BrandedSetupError } from "@/components/system/BrandedSetupError";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieSecret } from "@/lib/env";
import { accessDefaultLines, missingAccessEnv, safeAccessCookieNames } from "@/lib/env/safeEnv";

export const dynamic = "force-dynamic";

/** Owner and operator both read this one: it is where the month's bill is decided. */
async function hasCapacityAccess() {
  const missing = missingAccessEnv();
  if (missing.length) return { ok: false as const, missing };
  try {
    const env = getEnv();
    const { operatorCookieName, ownerCookieName } = safeAccessCookieNames();
    const secret = getV5AccessCookieSecret(env);
    const owner = await readV5AccessCookie((await cookies()).get(ownerCookieName)?.value, secret);
    if (owner?.kind === "owner") return { ok: true as const, missing: [] as string[] };
    const operator = await readV5AccessCookie((await cookies()).get(operatorCookieName)?.value, secret);
    return { ok: Boolean(operator?.kind === "operator"), missing: [] as string[] };
  } catch {
    return { ok: false as const, missing: [] as string[] };
  }
}

export default async function CapacityPage() {
  const access = await hasCapacityAccess();
  if (access.missing.length) {
    return <BrandedSetupError title="Plans & capacity is not configured yet." message="This page sits behind the operator gate. Set the missing variables so it stays there rather than falling through to a generic server error." missingVariables={access.missing} defaultValues={accessDefaultLines()} />;
  }
  if (!access.ok) redirect("/production-access/operator?next=%2Fapp%2Fcapacity");
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-8 text-brand-black sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
            <WestPeekProductionsLogo size="md" />
            <p className="mt-5 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Plans &amp; capacity</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">What the month has cost so far.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted">Transcode minutes first, because that is the cliff we reach first. Anything the provider will not tell the app says <strong>unknown</strong> and points at the dashboard that knows — no page here will ever show you a reassuring zero it made up.</p>
            <p className="mt-4 text-sm"><Link className="font-black underline" href="/production-access/launchpad">Back to the launchpad</Link></p>
          </section>
          <SafeSection label="Plans & capacity" render={() => CapacityReadout()} />
        </div>
      </main>
      <LegalFooter variant="standard" />
    </>
  );
}
