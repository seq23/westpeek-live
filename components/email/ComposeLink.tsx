import Link from "next/link";
import type { EmailAudienceKind } from "@/types/emailAudience";

/**
 * "Email speakers", from where the speakers are.
 *
 * The composer's event and audience are fields, so a link can fill them in. This is deliberately a
 * LINK and nothing else: it opens the composer with the group pre-picked, where the count, the
 * unsubscribe arithmetic and the confirm all still happen. No page that shows a list is allowed to
 * send from the list itself, because a send needs the screen that shows who it is going to.
 */
export function ComposeLink({ eventId, audience, label }: { eventId?: string; audience: EmailAudienceKind; label: string }) {
  const query = new URLSearchParams({ audience });
  if (eventId) query.set("event", eventId);
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
