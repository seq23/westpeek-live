import { createSupplierAction, updateSupplierAction } from "@/lib/actions/supplierActions";
import { SUPPLIER_KIND_COPY, SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, type SupplierKind, type SupplierRecord } from "@/types/suppliers";

/**
 * The one form both pages use, for both jobs. Adding and editing take the same fields in the same
 * order, so the owner learns it once; the only difference is which action it posts to and whether
 * the fields arrive filled in.
 *
 * `eventId` set means the form was opened from an event: whoever is created lands on that event
 * straight away, because that is what she opened it for.
 */
const INPUT = "mt-1 w-full rounded-xl border border-brand-line px-3 py-2 text-sm";
const LABEL = "block text-xs font-black uppercase tracking-wide text-brand-muted";

export function SupplierForm({ kind, supplier, eventId, returnTo }: { kind: SupplierKind; supplier?: SupplierRecord; eventId?: string; returnTo: string }) {
  const copy = SUPPLIER_KIND_COPY[kind];
  const editing = Boolean(supplier);
  const prefix = editing ? `supplier-edit-${supplier?.id}` : `supplier-new-${kind}`;
  return (
    <form action={editing ? updateSupplierAction : createSupplierAction} className="rounded-2xl border border-brand-line p-4" data-testid={editing ? `supplier-edit-form-${supplier?.id}` : `supplier-create-form-${kind}`}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
      {supplier ? <input type="hidden" name="supplierId" value={supplier.id} /> : null}
      <p className="font-black text-brand-black">{editing ? `Edit ${supplier?.name}` : `Add a ${copy.singular}`}</p>
      <p className="mt-1 text-xs text-brand-muted">{copy.whoTheyAre}{eventId && !editing ? ` They will be added to this event as soon as you save.` : ""}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>{kind === "vendor" ? "Contact name" : "Name"}
          <input name="name" defaultValue={supplier?.name || ""} required={kind === "contractor"} className={INPUT} data-testid={`${prefix}-name`} />
        </label>
        <label className={LABEL}>Company
          <input name="company" defaultValue={supplier?.company || ""} className={INPUT} data-testid={`${prefix}-company`} />
        </label>
        <label className={LABEL}>{copy.roleLabel}
          <input name="roleOrService" defaultValue={supplier?.roleOrService || ""} placeholder={kind === "vendor" ? "Captioning" : "Technical director"} className={INPUT} data-testid={`${prefix}-role`} />
        </label>
        <label className={LABEL}>Email
          <input name="email" type="email" defaultValue={supplier?.email || ""} className={INPUT} data-testid={`${prefix}-email`} />
        </label>
        <label className={LABEL}>Phone
          <input name="phone" defaultValue={supplier?.phone || ""} className={INPUT} data-testid={`${prefix}-phone`} />
        </label>
        <label className={LABEL}>{copy.rateLabel} (USD)
          <input name="rateAmount" inputMode="numeric" defaultValue={supplier?.rateAmount ? String(supplier.rateAmount) : ""} placeholder="Leave blank until it is agreed" className={INPUT} data-testid={`${prefix}-rate`} />
        </label>
        <label className={LABEL}>Paid by
          <select name="rateKind" defaultValue={supplier?.rateKind || (kind === "vendor" ? "quote" : "day_rate")} className={INPUT} data-testid={`${prefix}-rate-kind`}>
            <option value="day_rate">Day rate</option>
            <option value="quote">Quote for the job</option>
          </select>
        </label>
        <label className={LABEL}>Status
          <select name="status" defaultValue={supplier?.status || "shortlisted"} className={INPUT} data-testid={`${prefix}-status`}>
            {SUPPLIER_STATUSES.map((status) => <option key={status} value={status}>{SUPPLIER_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
      </div>
      <label className={`${LABEL} mt-3 block`}>Notes
        <textarea name="notes" defaultValue={supplier?.notes || ""} rows={2} placeholder="Anything the next person running a show with them needs to know." className={INPUT} data-testid={`${prefix}-notes`} />
      </label>
      {eventId && !editing ? (
        <label className={`${LABEL} mt-3 block`}>What are they doing on this event?
          <input name="eventNote" placeholder="2nd cam, hall B" className={INPUT} data-testid={`${prefix}-event-note`} />
        </label>
      ) : null}
      <button className="mt-3 rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white" data-testid={editing ? `supplier-save-${supplier?.id}` : `supplier-create-submit-${kind}`}>
        {editing ? "Save changes" : `Add the ${copy.singular}`}
      </button>
    </form>
  );
}
