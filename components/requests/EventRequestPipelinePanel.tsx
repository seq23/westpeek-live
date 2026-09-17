import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { approveEventRequestAction, declineEventRequestAction, markRequestPaidAction } from "@/lib/actions/eventRequestActions";
import { INSTRUCTION_AUDIENCES } from "@/services/event-intake/eventRequestEmails";
import { listEventRequests, sortRequestsByAttention } from "@/services/event-intake/eventRequestPipeline";
import { budgetRangeLabel, EVENT_REQUEST_STATE_LABELS, formatPrice, type EventRequestRecord } from "@/types/eventRequest";

/**
 * Every request that has come in, and the one thing each of them is waiting for.
 *
 * The list is ordered by what is waiting on West Peek rather than by date: a request nobody has
 * priced sits above a confirmed one, which sits above one that is already paid. The controls on a
 * row are only the ones its state allows, so there is no button here that can do the wrong thing.
 */
const STATE_TONE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-900",
  // Indigo is not a West Peek colour and validate:brand-system has been red on it. Confirmed is
  // the state that has been agreed and is waiting to be paid, which is exactly what the soft
  // orange tint is for: restrained emphasis on a live, active state.
  confirmed: "bg-brand-orangeSoft text-brand-black",
  paid: "bg-emerald-100 text-emerald-900",
  declined: "bg-slate-200 text-slate-700",
};

function RequestFacts({ request }: { request: EventRequestRecord }) {
  const facts: Array<[string, string | undefined]> = [
    ["Company", request.company],
    ["Event type", request.eventType],
    ["Target date", request.eventDate],
    ["Audience", request.audienceSize],
    ["Speakers", request.speakerCount],
    ["Support", request.supportLevel],
    ["Budget", budgetRangeLabel(request.budgetRange)],
  ];
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
      {facts.filter(([, value]) => value).map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <dt className="font-black text-brand-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function EventRequestPipelinePanel({ query }: { query?: Record<string, string | undefined> }) {
  const requests = sortRequestsByAttention(await listEventRequests());
  const waiting = requests.filter((request) => request.state === "requested" || request.state === "confirmed").length;

  return (
    <SectionCard title="Event requests" eyebrow={`${requests.length} request${requests.length === 1 ? "" : "s"}, ${waiting} waiting on you`}>
      <div data-testid="event-request-pipeline" data-request-count={requests.length} data-waiting={waiting}>
        {query?.requestError ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-900" data-testid="request-error">{query.requestError}</p> : null}
        {query?.approved ? (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="request-approved">
            Scope and price sent to {query.approved}.{query.provider === "mock" ? " Resend is not configured on this deployment, so it was recorded but not actually mailed." : ""}
          </p>
        ) : null}
        {query?.paid ? (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="request-paid">
            Marked paid. {query.paid} instruction message{query.paid === "1" ? "" : "s"} sent{Number(query.failed || 0) > 0 ? `, ${query.failed} failed` : ""}. Every one of them is in the email log.
          </p>
        ) : null}
        {query?.declined ? <p className="rounded-2xl bg-slate-100 p-3 text-sm font-bold text-slate-800" data-testid="request-declined">Declined. Tell the client yourself; nothing was mailed.</p> : null}

        {requests.length ? (
          <div className="mt-4 space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-3xl border border-brand-line p-4" data-testid={`request-row-${request.id}`} data-state={request.state}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-black text-brand-black">{request.company || request.name}</p>
                    <p className="text-xs text-brand-muted">{request.name} · {request.email} · came in <LocalTime iso={request.createdAt} mode="datetime" /></p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${STATE_TONE[request.state] || "bg-slate-100"}`} data-testid={`request-state-${request.id}`}>
                    {EVENT_REQUEST_STATE_LABELS[request.state]}
                  </span>
                </div>

                <RequestFacts request={request} />
                {request.notes ? <p className="mt-2 rounded-2xl bg-brand-ash p-3 text-xs">{request.notes}</p> : null}

                {request.scopeSummary ? (
                  <p className="mt-3 text-xs" data-testid={`request-scope-${request.id}`}>
                    <strong>{formatPrice(request.priceAmountCents, request.priceCurrency)}</strong> · {request.scopeSummary}
                  </p>
                ) : null}
                {request.confirmToken ? (
                  <p className="mt-1 text-xs text-brand-muted">Client link: <Link href={`/proposal/${request.confirmToken}`} className="font-bold underline" data-testid={`request-link-${request.id}`}>/proposal/{request.confirmToken.slice(0, 8)}…</Link></p>
                ) : null}
                {request.eventId ? <p className="mt-1 text-xs text-brand-muted">Event: <Link href={`/app/events/${request.eventId}`} className="font-bold underline">{request.eventId}</Link></p> : null}
                {request.paidAt ? (
                  <p className="mt-1 text-xs text-emerald-800" data-testid={`request-settlement-${request.id}`}>
                    Settled {request.settlementMethod === "manual" ? "by hand" : `through ${request.settlementMethod}`}
                    {request.settlementReference ? `, reference ${request.settlementReference}` : ""} · <LocalTime iso={request.paidAt} mode="datetime" />
                    {request.instructionsSentAt ? " · instructions sent" : " · instructions NOT sent"}
                  </p>
                ) : null}
                {request.declineReason ? <p className="mt-1 text-xs text-slate-700">Declined: {request.declineReason}</p> : null}

                {/* Price it and send the client their link. Re-pricing an approved request keeps the link they already have. */}
                {request.state === "requested" || request.state === "approved" ? (
                  <form action={approveEventRequestAction} className="mt-4 grid gap-2 rounded-2xl bg-brand-ash p-3">
                    <input type="hidden" name="requestId" value={request.id} />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-muted">{request.state === "approved" ? "Re-price and re-send" : "Approve: attach a price and a scope"}</p>
                    <input name="price" defaultValue={request.priceAmountCents ? String(request.priceAmountCents / 100) : ""} placeholder="4500" inputMode="decimal" className="min-h-10 rounded-xl border border-brand-line px-3 text-sm" data-testid={`request-price-${request.id}`} />
                    <textarea name="scopeSummary" defaultValue={request.scopeSummary || ""} rows={3} placeholder="What we are doing, in a sentence or two. The client reads this." className="rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid={`request-scope-input-${request.id}`} />
                    <button className="justify-self-start rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white" data-testid={`request-approve-${request.id}`}>Approve and send the client their link</button>
                  </form>
                ) : null}

                {/* Paid is the one state that sends the instructions, and it only opens once the client has said yes. */}
                {request.state === "confirmed" ? (
                  <form action={markRequestPaidAction} className="mt-4 grid gap-2 rounded-2xl bg-emerald-50 p-3">
                    <input type="hidden" name="requestId" value={request.id} />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-900">Mark paid and send the instructions</p>
                    <p className="text-xs text-emerald-900">
                      There is no payment provider on this deployment. When the money has arrived, press this: it records the settlement by hand and sends every address below its own instruction page. {request.email} is always told, whether or not you type it.
                    </p>
                    <input name="settlementReference" placeholder="Wire or cheque reference (optional)" className="min-h-10 rounded-xl border border-emerald-200 px-3 text-sm" data-testid={`request-reference-${request.id}`} />
                    {INSTRUCTION_AUDIENCES.map((entry) => (
                      <input
                        key={entry.audience}
                        name={`recipients_${entry.audience}`}
                        placeholder={`${entry.label}: name@example.com, another@example.com`}
                        className="min-h-10 rounded-xl border border-emerald-200 px-3 text-sm"
                        data-testid={`request-recipients-${entry.audience}-${request.id}`}
                      />
                    ))}
                    <button className="justify-self-start rounded-full bg-emerald-900 px-4 py-2 text-xs font-black text-white" data-testid={`request-mark-paid-${request.id}`}>Mark paid and send instructions</button>
                  </form>
                ) : null}

                {request.state !== "paid" && request.state !== "declined" ? (
                  <form action={declineEventRequestAction} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input name="declineReason" placeholder="Why we are not taking it" className="min-h-9 flex-1 rounded-xl border border-brand-line px-3 text-xs" data-testid={`request-decline-reason-${request.id}`} />
                    <button className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-black" data-testid={`request-decline-${request.id}`}>Decline</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title="No requests yet" body="Anything submitted at westpeek.live/request-event lands here with its budget range, and is priced from this page." />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
