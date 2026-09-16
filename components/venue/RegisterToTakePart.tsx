/**
 * Prompt, never block. Watching the show and reading the chat are open to anyone holding the link;
 * registering is what lets you take part. So this is an invitation that sits in view from the
 * moment someone arrives — not a modal, not an overlay across the video, nothing to dismiss before
 * watching — and the same words appear again at the control that actually needs it. Once the
 * person is registered it renders nothing, anywhere, ever again.
 */
const WHAT_IT_UNLOCKS = ["Post in the chat", "Show up on the People page", "Join networking", "Raise your hand to speak"];

export function RegisterToTakePart({ eventId, registered, context = "stage", returnTo }: { eventId: string; registered: boolean; context?: "stage" | "chat" | "networking" | "stage-request"; returnTo?: string }) {
  if (registered) return null;
  const line =
    context === "chat" ? "You can read along without signing up. To post, we need your name, email and company."
    : context === "networking" ? "Networking pairs you with another person by name, so we need your name, email and company first."
    : context === "stage-request" ? "To ask the crew to bring you on stage we need your name, email and company."
    : "Keep watching — nothing is in your way. Registering is what lets you take part.";
  const href = `/events/${eventId}/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <aside className="rounded-3xl border border-brand-orange/50 bg-brand-orangeSoft p-4" data-testid="register-to-take-part" data-register-context={context}>
      <p className="text-base font-black text-slate-950">Want to join in?</p>
      <p className="mt-1 text-sm leading-6 text-slate-800">{line} It takes about fifteen seconds.</p>
      {context === "stage" ? <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm font-semibold text-slate-800 sm:grid-cols-2">{WHAT_IT_UNLOCKS.map((item) => <li key={item}>· {item}</li>)}</ul> : null}
      <a href={href} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid="register-to-take-part-cta">Register</a>
    </aside>
  );
}
