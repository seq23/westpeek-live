import { notFound } from "next/navigation";
import Link from "next/link";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { confirmProposalAction } from "@/lib/actions/eventRequestActions";
import { getEventRequestByConfirmToken } from "@/services/event-intake/eventRequestPipeline";
import { budgetRangeLabel, formatPrice } from "@/types/eventRequest";

/**
 * The client's page: what we said we would do, what it costs, and the button that says yes.
 *
 * It is reached by token and by nothing else. There is no id in the URL to edit, no account to
 * create, and no login: the client got the link in an email and that is the whole of their
 * credential, which is why the token is 24 characters of crypto randomness and why this page shows
 * nothing at all when it does not match.
 *
 * Payment is settled by hand today. The page says so in those words rather than implying a card
 * form is coming in a moment, because a payment step that pretends is worse than one that is
 * honest about being a bank transfer.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your event scope and price | West Peek Live",
  robots: { index: false, follow: false },
};

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ confirmed?: string; confirmError?: string }>;
}) {
  const { token } = await params;
  const [request, query] = await Promise.all([
    getEventRequestByConfirmToken(token).catch(() => undefined),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  if (!request || request.state === "requested") notFound();

  const price = formatPrice(request.priceAmountCents, request.priceCurrency);
  const confirmed = request.state === "confirmed" || request.state === "paid";

  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10" data-testid="proposal" data-state={request.state}>
          <WestPeekProductionsLogo size="md" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Your event</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">{request.company || request.name}</h1>
          <p className="mt-2 text-sm text-brand-muted">Prepared for {request.name}. {request.eventType ? `${request.eventType}. ` : ""}{request.eventDate ? `Target date ${request.eventDate}.` : ""}</p>

          {request.state === "declined" ? (
            <div className="mt-6 rounded-2xl bg-slate-100 p-4 text-sm" data-testid="proposal-declined">
              <p className="font-bold">We are not able to take this one on.</p>
              <p className="mt-2">{request.declineReason}</p>
              <p className="mt-2">Reply to the email this link came from if anything about that changes.</p>
            </div>
          ) : (
            <>
              <div className="mt-8 rounded-2xl border border-brand-line p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-muted">What we will do</p>
                <p className="mt-2 text-sm leading-6" data-testid="proposal-scope">{request.scopeSummary}</p>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-brand-muted">Price</p>
                <p className="mt-1 text-3xl font-black" data-testid="proposal-price">{price}</p>
                <p className="mt-1 text-xs text-brand-muted">You told us your budget was {budgetRangeLabel(request.budgetRange)}.</p>
              </div>

              {query?.confirmError ? <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-900" data-testid="proposal-error">{query.confirmError}</p> : null}

              {confirmed ? (
                <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900" data-testid="proposal-confirmed">
                  <p className="font-black">You have confirmed this scope and price. Thank you.</p>
                  {request.state === "paid" ? (
                    <p className="mt-2">Payment is recorded and the instructions have gone out to everyone you named. Your own instructions are at <Link href="/how-it-works/client" className="font-bold underline">westpeek.live/how-it-works/client</Link>, and that page is kept up to date, so read it there rather than saving a copy.</p>
                  ) : (
                    <>
                      <p className="mt-2 font-bold">Step 2: paying.</p>
                      <p className="mt-1">
                        We do not take card payments on this site. We will send you an invoice for {price} with our bank details, payable by transfer. Reply to the email this link came from if you need a purchase order number on it, or if it has to go to somebody in accounts.
                      </p>
                      <p className="mt-2">
                        When the payment reaches us we mark it settled here, and the instructions go out the same minute to you, your crew, your speakers, your sponsors and your attendees. Each one is a link to a page we keep current, not a document that goes stale.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <form action={confirmProposalAction} className="mt-6 rounded-2xl border border-brand-line bg-brand-ash p-5">
                  <input type="hidden" name="token" value={token} />
                  <p className="text-sm font-black">Step 1: confirm the scope and the price.</p>
                  <p className="mt-2 text-xs text-brand-muted">
                    Pressing this tells us you agree to what is above. It does not take a payment and it does not ask for card details. We invoice you afterwards and payment is by bank transfer.
                  </p>
                  <button className="mt-4 rounded-full bg-brand-black px-6 py-3 text-sm font-black text-white" data-testid="proposal-confirm">Confirm this scope and price</button>
                  <p className="mt-3 text-xs text-brand-muted">Something is wrong with it? Reply to the email this link came from instead of pressing the button.</p>
                </form>
              )}
            </>
          )}
        </section>
      </main>
      <LegalFooter />
    </>
  );
}
