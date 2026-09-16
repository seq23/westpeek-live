import Link from "next/link";

/**
 * Every gate needs a way out that is not the browser's back button. A gate is reached by redirect,
 * so "back" lands on the page that sent you here and bounces straight back — the owner found
 * herself trapped on 16 Sep 2026. These are the exits: where you were trying to go (kept from
 * ?next= when it is a real in-app path), the Owner Console, the other doors, and the front page.
 */
export function safeGateNext(next: string | undefined) {
  if (!next) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  if (next.startsWith("/production-access") || next.startsWith("/login")) return undefined;
  return next;
}

export function GateExit({ next, className = "" }: { next?: string; className?: string }) {
  const target = safeGateNext(next);
  return (
    <nav className={`mt-6 flex flex-wrap items-center gap-3 text-xs font-black ${className}`} aria-label="Ways out of this gate" data-testid="gate-exit">
      {target ? <Link href={target} className="rounded-full border border-brand-black px-3 py-2 hover:border-brand-orange hover:text-brand-orange" data-testid="gate-exit-next">Back to where you were</Link> : null}
      <Link href="/app/owner" className="rounded-full border border-brand-black px-3 py-2 hover:border-brand-orange hover:text-brand-orange" data-testid="gate-exit-console">Owner console</Link>
      <Link href="/production-access" className="rounded-full border border-brand-line px-3 py-2 text-brand-muted hover:border-brand-orange hover:text-brand-orange" data-testid="gate-exit-doors">All the doors</Link>
      <Link href="/" className="rounded-full border border-brand-line px-3 py-2 text-brand-muted hover:border-brand-orange hover:text-brand-orange" data-testid="gate-exit-home">West Peek home</Link>
    </nav>
  );
}
