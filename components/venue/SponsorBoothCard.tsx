import type { VirtualVenueBooth } from "@/types/virtualVenue";

export function SponsorBoothCard({ booth }: { booth: VirtualVenueBooth }) {
  return (
    <a href={booth.href} className="block rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-slate-300">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sponsor booth</p>
      <h3 className="mt-2 text-lg font-semibold">{booth.name}</h3>
      <p className="mt-2 text-sm text-slate-600">{booth.headline}</p>
      <p className="mt-4 text-sm font-semibold">{booth.ctaLabel}</p>
    </a>
  );
}
