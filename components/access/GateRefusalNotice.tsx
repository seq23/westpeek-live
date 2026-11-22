/**
 * What a gate says when the limiter refused the attempt (services/access/gateAttemptLimiter.ts):
 * `too_many` after the per-minute limit, `paused` when the limiter itself is down and a production
 * door refuses rather than go unguarded. Renders nothing for any other error.
 */
export function GateRefusalNotice({ error, retry, hint }: { error?: string; retry?: string; hint?: string }) {
  const className = "mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800";
  if (error === "too_many") {
    const seconds = Number(retry) > 0 ? Math.min(Math.round(Number(retry)), 3600) : 60;
    return <p className={className} data-testid="gate-too-many">Too many tries from here. Wait about {seconds} seconds and try again{hint ? ` — ${hint}` : "."}</p>;
  }
  if (error === "paused") {
    return <p className={className} data-testid="gate-paused">Sign-in is paused because a safety check is not answering. Your password was not checked; try again in a minute.</p>;
  }
  return null;
}
