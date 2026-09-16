/**
 * Live is a state, so it looks like one: a brand-orange pill with a pulsing dot, not grey text
 * among grey text. The pulse is the only animated thing in the venue and it stops for a viewer who
 * has asked for reduced motion; the pill itself never does, because the pill is the information.
 */
export function LivePill({ href, label = "Live now" }: { href?: string; label?: string }) {
  const body = (
    <>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      {label}
    </>
  );
  const className = "inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white";
  return href ? <a href={href} className={className} data-testid="live-pill">{body}</a> : <span className={className} data-testid="live-pill">{body}</span>;
}
