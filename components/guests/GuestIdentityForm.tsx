import { registerGuestIdentityAction } from "@/lib/actions/guestActions";
import type { SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";

const ROLE_COPY: Record<SpecialGuestRole, { eyebrow: string; title: string; help: string }> = {
  speaker: { eyebrow: "Speaker portal", title: "Tell us who you are, once.", help: "Your speaker code carries the event; it does not carry your name. The crew's roster, the green room, and your cue cards are all yours from here." },
  sponsor: { eyebrow: "Sponsor portal", title: "Tell us who you are, once.", help: "Your sponsor code carries the event. Your booth for this event is set up under your name." },
  vip: { eyebrow: "VIP", title: "Tell us who you are, once.", help: "Your VIP code carries the event. The crew sees you by name." },
  client: { eyebrow: "Client portal", title: "Tell us who you are, once.", help: "Your client code carries the event. This read-only view is yours from here." },
};

/**
 * First entry through a role code. Same shape as attendee registration; stored as a special-guest
 * identity scoped to the event and bound to this browser. Rendered again with the existing values
 * to let the guest correct them.
 */
export function GuestIdentityForm({ eventId, role, returnTo, existing, error, compact = false, readOnly = false }: { eventId: string; role: SpecialGuestRole; returnTo: string; existing?: SpecialGuestProfile; error?: string; compact?: boolean; readOnly?: boolean }) {
  const copy = ROLE_COPY[role];
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-6 shadow-sm" data-testid="guest-identity-form" data-role={role} data-has-identity={existing ? "true" : "false"}>
      <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">{copy.eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">{existing ? `You are ${existing.name}` : copy.title}</h2>
      {!compact ? <p className="mt-2 max-w-2xl text-sm text-slate-600">{existing ? "Correct anything below and save again." : copy.help}</p> : null}
      {error ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900" data-testid="guest-identity-error">{error}</p> : null}
      <form action={readOnly ? undefined : registerGuestIdentityAction} className="mt-4 grid gap-3 md:grid-cols-3">
        <fieldset disabled={readOnly} className="contents">
        <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="role" value={role} /><input type="hidden" name="returnTo" value={returnTo} />
        <label className="grid gap-1 text-sm font-semibold text-slate-700">Your name<input name="name" required defaultValue={existing?.name} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Ada Lovelace" data-testid="guest-name" /></label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">Company<input name="company" defaultValue={existing?.company} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Analytical Engines" data-testid="guest-company" /></label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">Job title<input name="title" defaultValue={existing?.title} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Founder" data-testid="guest-title" /></label>
        <div className="md:col-span-3"><button className="rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-40" data-testid="guest-identity-submit">{existing ? "Save" : "Continue"}</button></div>
        </fieldset>
      </form>
    </section>
  );
}
