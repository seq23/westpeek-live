import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { SupplierRow } from "@/components/suppliers/SupplierRow";
import { attachSupplierAction } from "@/lib/actions/supplierActions";
import { listSuppliersAvailableForEvent, listSuppliersForEvent } from "@/services/suppliers/supplierRepository";
import { SUPPLIER_KIND_COPY, type SupplierKind } from "@/types/suppliers";

/**
 * Who is on THIS event. Attaching is a link to the one global record, so the same camera op on four
 * shows is one person with one rate, not four rows that drift apart. "Remove from this event"
 * detaches; the person stays, and so does every other event they are on.
 */
export async function EventSupplierBoard({ eventId, kind, searchParams = {} }: { eventId: string; kind: SupplierKind; searchParams?: Record<string, string | string[] | undefined> }) {
  const copy = SUPPLIER_KIND_COPY[kind];
  const returnTo = `/app/events/${eventId}/${kind === "vendor" ? "vendors" : "talent"}`;
  const globalList = kind === "vendor" ? "/app/vendors" : "/app/contractors";
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const [rows, available] = await Promise.all([listSuppliersForEvent(eventId, kind), listSuppliersAvailableForEvent(eventId, kind)]);

  return (
    <SectionCard title={`${copy.plural} on this event`} eyebrow={`${rows.length} attached`}>
      <div data-testid={`event-supplier-board-${kind}`} data-event={eventId} data-count={rows.length} data-available={available.length}>
        <p className="text-sm text-brand-muted">{copy.whoTheyAre} Everyone here is a real record on <Link href={globalList} className="underline">{copy.plural} across events</Link> — attaching them to this show does not make a copy.</p>
        {error ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-900" role="alert" data-testid={`event-supplier-error-${kind}`}>{error === "schema_missing" ? "The suppliers tables are not in this database yet. Apply migration 0033 and this page works." : decodeURIComponent(error)}</p> : null}

        {available.length ? (
          <form action={attachSupplierAction} className="mt-4 rounded-2xl border border-brand-line p-4" data-testid={`supplier-attach-form-${kind}`}>
            <input type="hidden" name="kind" value={kind} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="eventId" value={eventId} />
            <p className="font-black text-brand-black">Add someone already on file</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select name="supplierId" className="rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid={`supplier-attach-select-${kind}`}>
                {available.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.roleOrService ? ` — ${supplier.roleOrService}` : ""}</option>)}
              </select>
              <input name="eventNote" placeholder="What are they doing here?" className="min-w-[14rem] flex-1 rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid={`supplier-attach-note-${kind}`} />
              <button className="rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white" data-testid={`supplier-attach-submit-${kind}`}>Add to this event</button>
            </div>
          </form>
        ) : null}

        <div className="mt-3"><SupplierForm kind={kind} eventId={eventId} returnTo={returnTo} /></div>

        {rows.length ? (
          <ul className="mt-4 space-y-2">{rows.map((row) => <SupplierRow key={row.supplier.id} row={row} returnTo={returnTo} eventId={eventId} />)}</ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              title={`No ${copy.singular}s on this event yet`}
              body={available.length
                ? `You have ${available.length} ${copy.singular}${available.length === 1 ? "" : "s"} on file. Pick one above to put them on this show, or add a new one — either way they stay one record you can reuse on the next event.`
                : copy.emptyBody}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
