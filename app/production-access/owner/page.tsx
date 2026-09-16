import { LegalFooter } from "@/components/legal/LegalFooter";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret, matchOwnerMasterPassword } from "@/lib/env";
import { logAccessAttempt } from "@/services/access/accessAuditService";
import { createV5AccessCookie, getV5CookieOptions, readV5AccessCookie } from "@/lib/auth/productionAccess";
import { canOwnerAccessPath } from "@/lib/auth/v5RouteAuthorization";

async function enterOwner(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/app");
  const env = getEnv();

  // Either owner master password (OWNER_MASTER_ACCESS_PASSWORD or the optional _2) is a full owner.
  const ownerKey = matchOwnerMasterPassword(password, env);
  if (!ownerKey) {
    await logAccessAttempt({ status: "access_denied", accessKind: "owner", role: "owner", reason: "invalid_password", route: "/production-access/owner" });
    redirect("/production-access/owner?error=invalid");
  }

  const { ownerCookieName } = getV5AccessCookieNames(env);
  const cookie = await createV5AccessCookie({
    kind: "owner",
    role: "owner",
    ownerKey,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  }, getV5AccessCookieSecret(env));

  (await cookies()).set(ownerCookieName, cookie, getV5CookieOptions(60 * 60 * 12));

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  await logAccessAttempt({ status: "access_granted", accessKind: "owner", role: "owner", reason: `owner_master:${ownerKey}`, route: safeNext });
  redirect(safeNext);
}

export default async function OwnerAccessPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  // A valid owner cookie is not asked for the password again.
  if (!resolvedSearchParams?.error) {
    try {
      const env = getEnv();
      const { ownerCookieName } = getV5AccessCookieNames(env);
      const owner = await readV5AccessCookie((await cookies()).get(ownerCookieName)?.value, getV5AccessCookieSecret(env));
      const next = resolvedSearchParams?.next && resolvedSearchParams.next.startsWith("/") && !resolvedSearchParams.next.startsWith("//") ? resolvedSearchParams.next : "/app";
      if (owner?.kind === "owner" && canOwnerAccessPath(next, owner)) redirect(next);
    } catch {
      // Fall through to the form when access config is missing.
    }
  }
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
          <WestPeekProductionsLogo size="md" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Owner access</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Boss / owner master gate</h1>
          <p className="mt-4 text-sm leading-6 text-brand-muted">
            Use this only for owner-level show control, billing, settings, admin testing, and full event workspace access.
            Operator, crew, speaker, sponsor, client, and VIP access do not grant this authority.
          </p>
          <form action={enterOwner} className="mt-6 space-y-5">
            <input type="hidden" name="next" value={resolvedSearchParams?.next || "/app"} />
            <div>
              <label htmlFor="owner-password" className="text-sm font-black">Owner master password <span className="text-brand-orange">*</span></label>
              <input id="owner-password" name="password" required type="password" className="mt-2 min-h-12 w-full rounded-full border border-brand-line px-5 text-sm" />
            </div>
            <button className="w-full rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Enter owner workspace</button>
          </form>
          {resolvedSearchParams?.error ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Owner password did not match.</p> : null}
        </section>
      </main>
      <LegalFooter variant="compact" />
    </>
  );
}
