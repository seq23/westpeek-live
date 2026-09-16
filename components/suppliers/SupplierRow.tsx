import Link from "next/link";
import { archiveSupplierAction, detachSupplierAction, setSupplierStatusAction } from "@/lib/actions/supplierActions";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { SUPPLIER_KIND_COPY, SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, supplierRateLabel, type SupplierStatus } from "@/types/suppliers";
import type { SupplierWithEvents } from "@/services/suppliers/supplierRepository";

/**
 * One contractor or vendor, wherever they are shown. The same row on the global list and on an
 * event, so the rate and the status mean the same thing in both places; the event page adds
 * "Remove from this event", which detaches the link and never touches the person.
 */
const STATUS_TONE: Record<SupplierStatus, string> = {
  shortlisted: "bg-brand-ash text-brand-muted",
  booked: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
};

const PILL = "rounded-full border border-brand-line px-3 py-1 text-xs font-black hover:border-brand-orange hover:text-brand-orange";

export function SupplierRow({ row, returnTo, eventId }: { row: SupplierWithEvents; returnTo: string; eventId?: string }) {
  const { supplier, events } = row;
  const copy = SUPPLIER_KIND_COPY[supplier.kind];
  const onThisEvent = eventId ? events.find((event) => event.eventId === eventId) : undefined;
  return (
    <li className="rounded-2xl border border-brand-line p-4" data-testid={`supplier-row-${supplier.id}`} data-kind={supplier.kind} data-status={supplier.status} data-events={events.length}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-brand-black" data-testid={`supplier-name-${supplier.id}`}>{supplier.name}{supplier.company && supplier.company !== supplier.name ? <span className="text-brand-muted"> · {supplier.company}</span> : null}</p>
          <p className="text-xs text-brand-muted">
            {supplier.roleOrService || `${copy.roleLabel} not set`} · <span data-testid={`supplier-rate-${supplier.id}`}>{supplierRateLabel(supplier)}</span>
            {supplier.email ? <> · <a href={`mailto:${supplier.email}`} className="underline">{supplier.email}</a></> : null}
            {supplier.phone ? <> · {supplier.phone}</> : null}
          </p>
          {supplier.notes ? <p className="mt-1 text-xs text-brand-muted">{supplier.notes}</p> : null}
          {onThisEvent?.note ? <p className="mt-1 text-xs font-bold text-brand-black">On this event: {onThisEvent.note}</p> : null}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${STATUS_TONE[supplier.status]}`} data-testid={`supplier-status-${supplier.id}`}>{SUPPLIER_STATUS_LABELS[supplier.status]}</span>
      </div>

      <p className="mt-2 text-xs text-brand-muted" data-testid={`supplier-events-${supplier.id}`}>
        {events.length ? <>On {events.length} event{events.length === 1 ? "" : "s"}: {events.map((event, index) => (
          <span key={event.eventId}>{index ? ", " : ""}<Link href={`/app/events/${event.eventId}/${supplier.kind === "vendor" ? "vendors" : "talent"}`} className="underline" data-testid={`supplier-event-link-${supplier.id}-${event.eventId}`}>{event.eventName}</Link></span>
        ))}</> : <>Not on any event yet. Open an event and add them from its {supplier.kind === "vendor" ? "Vendors" : "Contractors"} page.</>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {SUPPLIER_STATUSES.filter((status) => status !== supplier.status).map((status) => (
          <form key={status} action={setSupplierStatusAction}>
            <input type="hidden" name="kind" value={supplier.kind} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="supplierId" value={supplier.id} /><input type="hidden" name="status" value={status} />
            {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
            <button className={PILL} data-testid={`supplier-set-${status}-${supplier.id}`}>Mark {SUPPLIER_STATUS_LABELS[status].toLowerCase()}</button>
          </form>
        ))}
        {onThisEvent ? (
          <form action={detachSupplierAction}>
            <input type="hidden" name="kind" value={supplier.kind} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="supplierId" value={supplier.id} /><input type="hidden" name="eventId" value={eventId} />
            <button className={PILL} data-testid={`supplier-detach-${supplier.id}`}>Remove from this event</button>
          </form>
        ) : null}
        <form action={archiveSupplierAction}>
          <input type="hidden" name="kind" value={supplier.kind} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="supplierId" value={supplier.id} />
          {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
          <button className={`${PILL} text-brand-muted`} data-testid={`supplier-archive-${supplier.id}`}>Archive</button>
        </form>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-brand-muted" data-testid={`supplier-edit-toggle-${supplier.id}`}>Edit details</summary>
        <div className="mt-2"><SupplierForm kind={supplier.kind} supplier={supplier} returnTo={returnTo} /></div>
      </details>
    </li>
  );
}
