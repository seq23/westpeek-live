import Link from "next/link";
import type { EmailAudienceKind } from "@/types/emailAudience";

/**
 * "Email speakers", from where the speakers are.
 *
 * The composer's event, audience, subject and message are all fields, so a link can fill them in.
 * This is deliberately a LINK and nothing else: it opens the composer with the group pre-picked and
 * the message already written, where the count, the unsubscribe arithmetic and the confirm all still
 * happen. No page that shows a list is allowed to send from the list itself, because a send needs
 * the screen that shows who it is going to. A prefilled message is a head start on the typing, never
 * a shortcut past the press — which is why the crew deck's "Email everyone the new link" is this.
 */
export function ComposeLink({ eventId, audience, label, subject, body }: { eventId?: string; audience: EmailAudienceKind; label: string; subject?: string; body?: string }) {
  const query = new URLSearchParams({ audience });
  if (eventId) query.set("event", eventId);
  if (subject) query.set("subject", subject);
  if (body) query.set("body", body);
  return (
    <Link
      href={`/app/email/compose?${query.toString()}`}
      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:border-brand-orange hover:text-brand-orange"
      data-testid={`compose-link-${audience}`}
    >
      {label}
    </Link>
  );
}
