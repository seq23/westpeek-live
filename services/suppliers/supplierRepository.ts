import { randomId } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { listEventRecords } from "@/services/events/eventRepository";
import { RuntimeSchemaMissingError } from "@/types/runtimeEvent";
import { suppliersCsv, supplierRefusal, type SupplierEventLink, type SupplierKind, type SupplierRateKind, type SupplierRecord, type SupplierStatus } from "@/types/suppliers";

/**
 * Contractors and vendors, and which events they are on.
 *
 * One store of suppliers with a `kind`; the two pages are two filters over it. An attachment is a
 * link row, so the same camera op can be on four shows and correcting her number corrects all four.
 * Everything here reads through the runtime store — no seed fixtures, ever.
 */
export interface SupplierInput {
  kind: SupplierKind;
  name: string;
  company?: string;
  roleOrService?: string;
  email?: string;
  phone?: string;
  rateKind?: SupplierRateKind;
  rateAmount?: number;
  notes?: string;
  status?: SupplierStatus;
}

export interface SupplierWithEvents {
  supplier: SupplierRecord;
  /** Every event this supplier is attached to, newest attachment first. */
  events: Array<{ eventId: string; eventName: string; note: string }>;
}

export interface SupplierListFilter {
  kind: SupplierKind;
  status?: SupplierStatus;
  eventId?: string;
  includeArchived?: boolean;
}

export class SupplierRefusedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SupplierRefusedError";
  }
}

/** A missing table must never take a page down — the surface shows its empty state and says why. */
function emptyOnMissingSchema<T>(fallback: T) {
  return (error: unknown): T => {
    if (error instanceof RuntimeSchemaMissingError) return fallback;
    throw error;
  };
}

function normalise(input: SupplierInput) {
  const rateAmount = Number(input.rateAmount ?? 0);
  const candidate = {
    kind: input.kind,
    name: (input.name || "").trim(),
    company: (input.company || "").trim(),
    roleOrService: (input.roleOrService || "").trim(),
    email: (input.email || "").trim(),
    phone: (input.phone || "").trim(),
    rateKind: (input.rateKind || (input.kind === "vendor" ? "quote" : "day_rate")) as SupplierRateKind,
    rateAmount: Number.isFinite(rateAmount) ? Math.round(rateAmount) : Number.NaN,
    notes: (input.notes || "").trim(),
    status: (input.status || "shortlisted") as SupplierStatus,
  };
  const refusal = supplierRefusal(candidate);
  if (refusal) throw new SupplierRefusedError(refusal);
  // A vendor entered as a company alone still needs a name to show in a list.
  if (!candidate.name) candidate.name = candidate.company;
  return candidate;
}

export async function createSupplier(input: SupplierInput): Promise<SupplierRecord> {
  const now = new Date().toISOString();
  const supplier: SupplierRecord = { id: randomId(input.kind === "vendor" ? "vendor" : "contractor"), ...normalise(input), createdAt: now, updatedAt: now };
  return getRuntimeStore().upsertSupplier(supplier);
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<SupplierRecord | undefined> {
  const store = getRuntimeStore();
  const existing = await store.getSupplier(id);
  if (!existing) return undefined;
  return store.upsertSupplier({ ...existing, ...normalise({ ...input, kind: existing.kind }), updatedAt: new Date().toISOString() });
}

/** shortlisted → booked → paid, in either direction; the owner corrects a mis-click without a rebuild. */
export async function setSupplierStatus(id: string, status: SupplierStatus): Promise<SupplierRecord | undefined> {
  const store = getRuntimeStore();
  const existing = await store.getSupplier(id);
  if (!existing) return undefined;
  return store.upsertSupplier({ ...existing, status, updatedAt: new Date().toISOString() });
}

/** Archive, never delete: the row and every event it worked stay on the record. */
export async function archiveSupplier(id: string): Promise<SupplierRecord | undefined> {
  const store = getRuntimeStore();
  const existing = await store.getSupplier(id);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  return store.upsertSupplier({ ...existing, archivedAt: now, updatedAt: now });
}

export async function attachSupplierToEvent(supplierId: string, eventId: string, note = ""): Promise<SupplierEventLink | undefined> {
  const store = getRuntimeStore();
  const supplier = await store.getSupplier(supplierId);
  if (!supplier) return undefined;
  // Re-attaching is not a second row; it updates the note on the one attachment.
  const existing = (await store.listSupplierEventLinks()).find((link) => link.supplierId === supplierId && link.eventId === eventId);
  const link: SupplierEventLink = existing
    ? { ...existing, note: note.trim() || existing.note }
    : { id: randomId("supplier-link"), supplierId, eventId, note: note.trim(), createdAt: new Date().toISOString() };
  return store.upsertSupplierEventLink(link);
}

export async function detachSupplierFromEvent(supplierId: string, eventId: string): Promise<void> {
  await getRuntimeStore().deleteSupplierEventLink(supplierId, eventId);
}

async function eventNames(): Promise<Record<string, string>> {
  const events = await listEventRecords({ includeArchived: true, includeSeed: false }).catch(() => []);
  return Object.fromEntries(events.map((event) => [event.id, event.name]));
}

async function withEvents(suppliers: SupplierRecord[], links: SupplierEventLink[], names: Record<string, string>): Promise<SupplierWithEvents[]> {
  const bySupplier = new Map<string, SupplierEventLink[]>();
  for (const link of links) bySupplier.set(link.supplierId, [...(bySupplier.get(link.supplierId) || []), link]);
  return suppliers.map((supplier) => ({
    supplier,
    events: (bySupplier.get(supplier.id) || []).map((link) => ({ eventId: link.eventId, eventName: names[link.eventId] || link.eventId, note: link.note })),
  }));
}

/**
 * The global list behind /app/contractors and /app/vendors: one kind, optionally narrowed to a
 * status and to one event. The CSV export runs through this same call with the same filter, so the
 * file and the page can never disagree.
 */
export async function listSuppliersWithEvents(filter: SupplierListFilter): Promise<SupplierWithEvents[]> {
  const store = getRuntimeStore();
  const [all, links, names] = await Promise.all([
    store.listSuppliers(filter.includeArchived).catch(emptyOnMissingSchema<SupplierRecord[]>([])),
    store.listSupplierEventLinks().catch(emptyOnMissingSchema<SupplierEventLink[]>([])),
    eventNames(),
  ]);
  const ofKind = all.filter((supplier) => supplier.kind === filter.kind && (!filter.status || supplier.status === filter.status));
  const rows = await withEvents(ofKind, links, names);
  return filter.eventId ? rows.filter((row) => row.events.some((event) => event.eventId === filter.eventId)) : rows;
}

/** Who is on THIS event, of one kind — the event's own Contractors and Vendors pages. */
export async function listSuppliersForEvent(eventId: string, kind: SupplierKind): Promise<SupplierWithEvents[]> {
  return listSuppliersWithEvents({ kind, eventId });
}

/** Everyone of this kind who is NOT yet on the event: the attach picker, and nothing else. */
export async function listSuppliersAvailableForEvent(eventId: string, kind: SupplierKind): Promise<SupplierRecord[]> {
  const rows = await listSuppliersWithEvents({ kind });
  return rows.filter((row) => !row.events.some((event) => event.eventId === eventId)).map((row) => row.supplier);
}

/** Every event any supplier of this kind is on — the "filter by event" dropdown, real events only. */
export async function supplierEventOptions(kind: SupplierKind): Promise<Array<{ eventId: string; eventName: string }>> {
  const rows = await listSuppliersWithEvents({ kind });
  const options = new Map<string, string>();
  for (const row of rows) for (const event of row.events) options.set(event.eventId, event.eventName);
  return Array.from(options.entries()).map(([eventId, eventName]) => ({ eventId, eventName })).sort((a, b) => a.eventName.localeCompare(b.eventName));
}

export async function suppliersCsvForFilter(filter: SupplierListFilter): Promise<string> {
  const rows = await listSuppliersWithEvents(filter);
  return suppliersCsv(rows.map((row) => ({ supplier: row.supplier, eventNames: row.events.map((event) => event.eventName) })));
}
