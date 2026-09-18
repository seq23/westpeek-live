import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WestPeekProductionsLogoHomeLink } from "@/components/brand/WestPeekProductionsLogo";
import { BrandedSetupError } from "@/components/system/BrandedSetupError";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieSecret } from "@/lib/env";
import { accessDefaultLines, missingAccessEnv, safeAccessCookieNames } from "@/lib/env/safeEnv";

export const dynamic = "force-dynamic";

async function requireOperatorPacketAccess() {
  const missing = missingAccessEnv();
  if (missing.length) return { ok: false as const, missing };
  const env = getEnv();
  const { operatorCookieName, ownerCookieName } = safeAccessCookieNames();
  const secret = getV5AccessCookieSecret(env);
  const ownerPayload = await readV5AccessCookie((await cookies()).get(ownerCookieName)?.value, secret);
  if (ownerPayload?.kind === "owner") return { ok: true as const, missing: [] as string[] };
  const operatorPayload = await readV5AccessCookie((await cookies()).get(operatorCookieName)?.value, secret);
  return { ok: Boolean(operatorPayload?.kind === "operator"), missing: [] as string[] };
}

export default async function OperatorPacketRoute() {
  const access = await requireOperatorPacketAccess();
  if (access.missing.length) {
    return <BrandedSetupError title="Operator packet is not configured yet." message="This packet contains internal access instructions and Day 1 passwords, so it must stay behind the operator gate. Set the access variables below before using the in-app packet route." missingVariables={access.missing} defaultValues={accessDefaultLines()} />;
  }
  if (!access.ok) redirect("/production-access/operator?error=operator_packet_required");
  return (
    <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <article className="mx-auto max-w-5xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogoHomeLink size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Day 1 Operator Packet</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">West Peek Live operator guide</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted">This in-app version summarizes the full packet. The repo includes the complete Markdown packet at docs/AGENCY_EVENT_OS_DAY1_OPERATOR_PACKET.md and the sendable DOCX packet.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl bg-brand-ash p-5"><h2 className="font-black">Access model</h2><p className="mt-2 text-sm leading-6">Owner master, operator, crew, and event-scoped guest codes stay in the private vault. Public pages must never display Day 1 passwords.</p></section>
          <section className="rounded-3xl bg-brand-ash p-5"><h2 className="font-black">Livestream model</h2><p className="mt-2 text-sm leading-6">StreamYard production feed/source → LiveKit embedded distribution → Daily embedded fallback → Zoom + Google Meet backup continuity links.</p></section>
          <section className="rounded-3xl bg-brand-ash p-5"><h2 className="font-black">Run-of-show spine</h2><p className="mt-2 text-sm leading-6">Agenda → Run of Show → Call Sheet → Show Caller View → Live Cues → Incidents → Post-Event Report.</p></section>
          <section className="rounded-3xl bg-brand-ash p-5"><h2 className="font-black">Testing/admin spine</h2><p className="mt-2 text-sm leading-6">Testing Console → Route Health → Access Gates → Supabase Runtime → Event Config Package → Video Providers → Post-Deploy Smoke.</p></section>
        </div>
        <div className="mt-8 flex flex-wrap gap-3"><Link className="rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white" href="/production-access/launchpad">Open Operator Launchpad</Link><Link className="rounded-full border border-brand-black px-5 py-3 text-sm font-bold" href="/venue/demo/lobby">Preview Demo Venue</Link></div>
      </article>
    </main>
  );
}
