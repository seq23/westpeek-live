import { confirmUnsubscribeAction, undoUnsubscribeAction } from "@/lib/actions/unsubscribeActions";
import { findUnsubscribe, readUnsubscribeToken } from "@/services/email/emailSuppressionService";
import { unsubscribeIsActive } from "@/types/emailAudience";

export const dynamic = "force-dynamic";

/**
 * Stopping West Peek's announcements, without a login and without a support ticket.
 *
 * Arriving here from the footer link takes the person off the list immediately — that is what the
 * link says it does, and making somebody click twice to stop email is how a domain earns spam
 * complaints instead of unsubscribes. The page then says plainly what happened and offers the way
 * back for the person who pressed it by mistake.
 *
 * The page is deliberately outside every protected prefix in lib/auth/routeAccess: the recipient of
 * an announcement has no account here and never will.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16" data-testid="unsubscribe-page">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">West Peek Live!</p>
      <div className="mt-4 rounded-3xl border border-brand-line bg-white p-8 shadow-sm">{children}</div>
    </main>
  );
}

export default async function UnsubscribePage({ searchParams }: { searchParams?: Promise<{ token?: string; state?: string }> }) {
  const query = searchParams ? await searchParams : undefined;
  const token = String(query?.token || "");
  const email = token ? await readUnsubscribeToken(token) : undefined;

  if (!email) {
    return (
      <Shell>
        <h1 className="text-2xl font-black text-slate-950" data-testid="unsubscribe-invalid">This unsubscribe link is not valid.</h1>
        <p className="mt-3 text-sm text-slate-600">
          It may have been cut in half by your mail app. Open the message again and press the link whole, or reply to it and we will take you off the list by hand.
        </p>
      </Shell>
    );
  }

  // The link means what it says: arriving here stops the announcements. Pressing it twice, or a mail
  // client fetching it in the background, lands on the same state — the record is keyed by address.
  if (query?.state !== "on") {
    const existing = await findUnsubscribe(email);
    if (!existing || !unsubscribeIsActive(existing)) {
      const { recordUnsubscribe } = await import("@/services/email/emailSuppressionService");
      await recordUnsubscribe({ email, source: "one_click" }).catch(() => undefined);
    }
  }

  const current = await findUnsubscribe(email);
  const off = Boolean(current && unsubscribeIsActive(current));

  return (
    <Shell>
      {off ? (
        <>
          <h1 className="text-2xl font-black text-slate-950" data-testid="unsubscribe-done">You are unsubscribed.</h1>
          <p className="mt-3 text-sm text-slate-600" data-testid="unsubscribe-address">
            <strong>{email}</strong> will not get announcements from any West Peek Live! event again.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Messages addressed to you personally — your speaker green room link, your booth setup, the report you asked for — still reach you. Those are not announcements and this does not stop them.
          </p>
          <form action={undoUnsubscribeAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:border-brand-orange hover:text-brand-orange" data-testid="unsubscribe-undo">
              I did that by mistake — put me back on
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black text-slate-950" data-testid="unsubscribe-back-on">You are back on the list.</h1>
          <p className="mt-3 text-sm text-slate-600">
            <strong>{email}</strong> will get West Peek Live! event announcements again.
          </p>
          <form action={confirmUnsubscribeAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button className="rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange" data-testid="unsubscribe-again">
              Actually, unsubscribe me
            </button>
          </form>
        </>
      )}
    </Shell>
  );
}
