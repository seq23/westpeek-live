import { redeemVipCodeAction } from "@/lib/actions/vipActions";

/**
 * "Have a VIP code?" on the lobby, for someone already registered as an attendee. Typing the code
 * is what makes them a VIP — there is no other way in from here, and the code they type is the
 * event's real VIP code, matched the way every other code is (case, spaces and dashes forgiven).
 */
export function VipCodeCard({ eventId, registered, result }: { eventId: string; registered: boolean; result?: "1" | "no" }) {
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-5" data-testid="vip-code-card" data-registered={registered ? "true" : "false"}>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Have a VIP code?</p>
      <p className="mt-2 text-sm text-brand-muted">If production gave you one, put it in here and the VIP badge and lounge open for you. It looks like <code className="rounded bg-brand-ash px-1">WPL-VIP-…</code>.</p>
      {result === "no" ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900" data-testid="vip-code-refused">That is not this event&rsquo;s VIP code. Check it with whoever invited you.</p> : null}
      {result === "1" ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="vip-code-accepted">You are a VIP for this event. The badge and the lounge are yours.</p> : null}
      {registered ? (
        <form action={redeemVipCodeAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="eventId" value={eventId} />
          <input name="code" placeholder="WPL-VIP-…" className="min-w-[12rem] rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="vip-code-input" />
          <button className="rounded-full bg-brand-black px-4 py-2 text-sm font-black text-white" data-testid="vip-code-submit">Use the code</button>
        </form>
      ) : (
        <p className="mt-3 text-sm"><a href={`/events/${eventId}/register?reason=vip`} className="font-black underline" data-testid="vip-code-register">Register first</a> — the VIP code attaches to you, so we need to know who you are.</p>
      )}
    </section>
  );
}
