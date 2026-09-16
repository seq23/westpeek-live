import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { SupplierRow } from "@/components/suppliers/SupplierRow";
import { listSuppliersWithEvents, supplierEventOptions } from "@/services/suppliers/supplierRepository";
import { SUPPLIER_KIND_COPY, SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, isSupplierStatus, type SupplierKind } from "@/types/suppliers";

/**
 * Everyone of one kind, across every event. Filters are plain links, so the URL is the view: the
 * CSV button carries the same query string and exports exactly the rows on screen — a "booked only"
 * page can never hand back a spreadsheet with the people we did not hire in it.
 */
function FilterLink({ href, active, label, testId }: { href: string; active: boolean; label: string; testId: string }) {
  return <a href={href} data-testid={testId} data-active={active ? "true" : "false"} className={`rounded-full px-3 py-1 text-xs font-black ${active ? "bg-brand-black text-white" : "border border-brand-line text-brand-muted hover:border-brand-orange hover:text-brand-orange"}`}>{label}</a>;
}

export async function SupplierDirectory({ kind, searchParams = {} }: { kind: SupplierKind; searchParams?: Record<string, string | string[] | undefined> }) {
  const copy = SUPPLIER_KIND_COPY[kind];
  const base = kind === "vendor" ? "/app/vendors" : "/app/contractors";
  const statusParam = typeof searchParams.status === "string" && isSupplierStatus(searchParams.status) ? searchParams.status : undefined;
  const eventParam = typeof searchParams.event === "string" && searchParams.event ? searchParams.event : undefined;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;

  const [rows, eventOptions, unfiltered] = await Promise.all([
    listSuppliersWithEvents({ kind, status: statusParam, eventId: eventParam }),
    supplierEventOptions(kind),
    listSuppliersWithEvents({ kind }),
  ]);

  const query = (next: { status?: string; event?: string }) => {
    const params = new URLSearchParams();
    const status = next.status !== undefined ? next.status : statusParam || "";
    const event = next.event !== undefined ? next.event : eventParam || "";
    if (status) params.set("status", status);
    if (event) params.set("event", event);
    const suffix = params.toString();
    return suffix ? `${base}?${suffix}` : base;
  };
  const exportQuery = new URLSearchParams({ kind, ...(statusParam ? { status: statusParam } : {}), ...(eventParam ? { event: eventParam } : {}) }).toString();
  const filtered = Boolean(statusParam || eventParam);

  return (
    <SectionCard title={`${copy.plural} across events`} eyebrow={`${rows.length} of ${unfiltered.length}`}>
      <div data-testid={`supplier-directory-${kind}`} data-count={rows.length} data-total={unfiltered.length} data-status-filter={statusParam || ""} data-event-filter={eventParam || ""}>
        <p className="text-sm text-brand-muted">{copy.whoTheyAre} One record each, attached to as many events as they work — correcting a rate or a number here corrects it on every show.</p>
        {error ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-900" role="alert" data-testid={`supplier-error-${kind}`}>{error === "schema_missing" ? "The suppliers tables are not in this database yet. Apply migration 0033 and this page works." : decodeURIComponent(error)}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid={`supplier-filters-${kind}`}>
          <span className="text-xs font-black uppercase tracking-wide text-brand-muted">Status</span>
          <FilterLink href={query({ status: "" })} active={!statusParam} label="All" testId={`supplier-filter-status-all-${kind}`} />
          {SUPPLIER_STATUSES.map((status) => <FilterLink key={status} href={query({ status })} active={statusParam === status} label={SUPPLIER_STATUS_LABELS[status]} testId={`supplier-filter-status-${status}-${kind}`} />)}
          {eventOptions.length ? (
            <>
              <span className="ml-2 text-xs font-black uppercase tracking-wide text-brand-muted">Event</span>
              <FilterLink href={query({ event: "" })} active={!eventParam} label="All" testId={`supplier-filter-event-all-${kind}`} />
              {eventOptions.map((option) => <FilterLink key={option.eventId} href={query({ event: option.eventId })} active={eventParam === option.eventId} label={option.eventName} testId={`supplier-filter-event-${option.eventId}-${kind}`} />)}
            </>
          ) : null}
          <a href={`/api/suppliers/export?${exportQuery}`} className="ml-auto rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white" data-testid={`supplier-export-csv-${kind}`}>Download CSV</a>
        </div>

        <div className="mt-4"><SupplierForm kind={kind} returnTo={base} /></div>

        {rows.length ? (
          <ul className="mt-4 space-y-2">{rows.map((row) => <SupplierRow key={row.supplier.id} row={row} returnTo={base} />)}</ul>
        ) : (
          <div className="mt-4">
            {filtered && unfiltered.length
              ? <EmptyState title={`No ${copy.singular}s match this filter`} body={`${unfiltered.length} ${copy.singular}${unfiltered.length === 1 ? " is" : "s are"} on file — none of them with this status on this event. Clear the filter above to see everyone.`} />
              : <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
