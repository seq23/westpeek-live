import Link from "next/link";
import { LocalTime } from "@/components/shared/LocalTime";
import { CLOUDFLARE_STREAM_PLAN, CLOUDFLARE_WORKERS_PLAN, SUPABASE_PLAN, fractionUsed } from "@/lib/capacity/capacityPlans";
import { readCapacityPosition, type CapacityReading } from "@/services/capacity/capacityReadingService";

/**
 * WHERE THE MONTH STANDS AGAINST THE PLANS.
 *
 * Transcode minutes come first and get the bar, because they are the first cliff: 600 a month on
 * Ship, and every minute of StreamYard feed pushed into an ingress burns one.
 *
 * A reading we could not take prints "unknown" and the reason — never a zero. A zero on this page
 * would read as "nothing spent yet", which on the 28th of a busy month is the most expensive lie
 * the page could tell.
 */

const NUMBER = new Intl.NumberFormat("en-US");

function formatValue(reading: CapacityReading) {
  if (reading.value === null) return "unknown";
  if (reading.key === "supabaseAwake") return reading.value === 1 ? "yes" : "no";
  return `${NUMBER.format(Math.round(reading.value * 100) / 100)} ${reading.unit}`;
}

function formatLimit(reading: CapacityReading) {
  if (reading.limit === null) return "";
  return `of ${NUMBER.format(reading.limit)} ${reading.unit}`;
}

/** The bar only draws when BOTH sides of the fraction are real. Otherwise the row says so in words. */
function UsageBar({ reading, prominent = false }: { reading: CapacityReading; prominent?: boolean }) {
  const fraction = fractionUsed(reading.value, reading.limit);
  if (fraction === null) {
    return <div className="mt-2 rounded-full border border-dashed border-brand-line bg-brand-ash px-3 py-1 text-[11px] font-black uppercase tracking-wide text-brand-muted" data-testid={`capacity-bar-${reading.key}-unknown`}>No bar: the number is unknown</div>;
  }
  const percent = Math.min(100, Math.round(fraction * 1000) / 10);
  const tone = fraction >= 0.9 ? "bg-brand-orange" : fraction >= 0.7 ? "bg-brand-charcoal" : "bg-brand-black";
  return (
    <div className={`mt-2 w-full overflow-hidden rounded-full bg-brand-ash ${prominent ? "h-4" : "h-2"}`} role="img" aria-label={`${percent}% of ${reading.label} used`} data-testid={`capacity-bar-${reading.key}`} data-percent={percent}>
      <div className={`h-full ${tone}`} style={{ width: `${Math.max(percent, 1)}%` }} />
    </div>
  );
}

function ReadingRow({ reading, prominent = false }: { reading: CapacityReading; prominent?: boolean }) {
  const isUnknown = reading.value === null;
  return (
    <li className={`rounded-2xl border p-4 ${prominent ? "border-brand-orange bg-brand-orangeSoft" : "border-brand-line bg-white"}`} data-testid={`capacity-reading-${reading.key}`} data-unknown={isUnknown ? "true" : "false"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`font-black text-brand-black ${prominent ? "text-lg" : "text-sm"}`}>{reading.label}</p>
        <p className={`font-black ${prominent ? "text-2xl" : "text-base"} ${isUnknown ? "text-brand-muted" : "text-brand-black"}`} data-testid={`capacity-value-${reading.key}`}>
          {formatValue(reading)} <span className="text-xs font-bold text-brand-muted">{formatLimit(reading)}</span>
        </p>
      </div>
      <UsageBar reading={reading} prominent={prominent} />
      <p className="mt-2 text-xs leading-5 text-brand-muted">{isUnknown ? reading.unknownReason : `Read from ${reading.source}.`}</p>
    </li>
  );
}

async function CapacityBody() {
  const position = await readCapacityPosition();
  const [transcode, ...restOfMonth] = position.livekit;
  return (
    <div className="space-y-6" data-testid="capacity-readout">
      <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">First cliff</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Transcode minutes</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {position.plan.label}
          {position.plan.monthlyUsd !== null ? ` · $${position.plan.monthlyUsd}/mo` : ""}
          {position.plan.confirmed ? "" : " · these allowances were never read from the dashboard"}
          . Every minute of StreamYard feed pushed into an ingress burns one, whether five people watch or five hundred.
        </p>
        <ul className="mt-4 space-y-3"><ReadingRow reading={transcode} prominent /></ul>
      </section>

      <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black tracking-tight">The rest of the LiveKit month</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">{restOfMonth.map((reading) => <ReadingRow key={reading.key} reading={reading} />)}</ul>
      </section>

      <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black tracking-tight">LiveKit, right now</h2>
        <p className="mt-1 text-sm text-brand-muted">What the project API does answer: the live picture this instant, not the month.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">{position.livekitNow.map((reading) => <ReadingRow key={reading.key} reading={reading} />)}</ul>
      </section>

      <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black tracking-tight">Cloudflare</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {CLOUDFLARE_WORKERS_PLAN.label} · ${CLOUDFLARE_WORKERS_PLAN.monthlyUsd}/mo · {NUMBER.format(CLOUDFLARE_WORKERS_PLAN.includedRequests)} requests, {CLOUDFLARE_WORKERS_PLAN.cpuMsPerInvocation / 1000}s CPU, {CLOUDFLARE_WORKERS_PLAN.variablesPerWorker} variables (the repo holds itself to {CLOUDFLARE_WORKERS_PLAN.repoVariableBudget}).
          {" "}{CLOUDFLARE_STREAM_PLAN.label}: ${CLOUDFLARE_STREAM_PLAN.usdPerThousandMinutesStored} per 1,000 minutes stored, ${CLOUDFLARE_STREAM_PLAN.usdPerThousandMinutesDelivered} per 1,000 delivered, live input <code className="rounded bg-brand-ash px-1">{CLOUDFLARE_STREAM_PLAN.liveInputName}</code>.
        </p>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">{position.cloudflare.map((reading) => <ReadingRow key={reading.key} reading={reading} />)}</ul>
      </section>

      <section className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black tracking-tight">Supabase</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {SUPABASE_PLAN.label} · {SUPABASE_PLAN.databaseMb} MB database, {SUPABASE_PLAN.egressGb} GB egress, no backups, and it pauses after {SUPABASE_PLAN.autoPauseIdleDays} idle days. A scheduled keep-alive reads one row a day so it never gets there.
        </p>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">{position.supabase.map((reading) => <ReadingRow key={reading.key} reading={reading} />)}</ul>
      </section>

      <p className="text-xs text-brand-muted">
        Read <LocalTime iso={position.readAt} mode="datetime" />. The figures marked unknown live in the provider dashboards; nothing on this page is estimated. Full detail: <Link className="font-black underline" href="/api/runtime/keep-alive">the keep-alive probe</Link>.
      </p>
    </div>
  );
}

export function CapacityReadout() {
  return CapacityBody();
}
