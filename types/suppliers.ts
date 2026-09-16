/**
 * Everybody outside West Peek that a show pays.
 *
 * A CONTRACTOR is a person hired for a role on a show — a moderator, a technical director, a
 * camera op. A VENDOR is a company supplying a service — catering, AV hire, captioning. They are
 * one record with a `kind`, not two tables: every field is the same, both are attached to events
 * the same way, both are filtered, exported and paid the same way. Two tables would have meant two
 * migrations, two repositories and two copies of every list — for a word.
 *
 * A supplier is GLOBAL. The same camera op works four shows; attaching them to an event is a link,
 * never a copy, so a phone number corrected once is corrected everywhere.
 */
export type SupplierKind = "contractor" | "vendor";

/** shortlisted → booked → paid. Money moves at `paid`; nothing here pays anyone. */
export type SupplierStatus = "shortlisted" | "booked" | "paid";

/** A person is hired by the day; a company quotes the job. The number means nothing without it. */
export type SupplierRateKind = "day_rate" | "quote";

export interface SupplierRecord {
  id: string;
  kind: SupplierKind;
  /** The person's name, or the company's when the vendor has no named contact. */
  name: string;
  company: string;
  /** "Technical director" for a contractor, "Captioning" for a vendor. */
  roleOrService: string;
  email: string;
  phone: string;
  rateKind: SupplierRateKind;
  /** Whole currency units. 0 means "not agreed yet" and the row says so rather than showing $0. */
  rateAmount: number;
  notes: string;
  status: SupplierStatus;
  /** Archiving is the only removal: the row and its event history both stay. */
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** One supplier on one event. The same supplier can hold as many of these as they have shows. */
export interface SupplierEventLink {
  id: string;
  supplierId: string;
  eventId: string;
  /** What they are doing on THIS event when it differs from their usual role ("2nd cam, hall B"). */
  note: string;
  createdAt: string;
}

export const SUPPLIER_STATUSES: readonly SupplierStatus[] = ["shortlisted", "booked", "paid"];

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  shortlisted: "Shortlisted",
  booked: "Booked",
  paid: "Paid",
};

export const SUPPLIER_KIND_COPY: Record<SupplierKind, { singular: string; plural: string; whoTheyAre: string; roleLabel: string; rateLabel: string; emptyTitle: string; emptyBody: string }> = {
  contractor: {
    singular: "contractor",
    plural: "Contractors",
    whoTheyAre: "People you pay for a role on a show — a moderator, a technical director, a camera op.",
    roleLabel: "Role",
    rateLabel: "Day rate",
    emptyTitle: "No contractors yet",
    emptyBody: "Add the people you hire for a show — moderator, technical director, camera op — with what they cost and how to reach them. Once someone is here you can attach them to any event, and their rate and number stay right across every show.",
  },
  vendor: {
    singular: "vendor",
    plural: "Vendors",
    whoTheyAre: "Companies supplying a service — catering, AV hire, captioning.",
    roleLabel: "Service",
    rateLabel: "Quote",
    emptyTitle: "No vendors yet",
    emptyBody: "Add the companies that supply a show — catering, AV hire, captioning — with the quote and who to call. Once a company is here you can attach it to any event, and one corrected phone number is corrected on every show.",
  },
};

export function isSupplierKind(value: string): value is SupplierKind {
  return value === "contractor" || value === "vendor";
}

export function isSupplierStatus(value: string): value is SupplierStatus {
  return (SUPPLIER_STATUSES as readonly string[]).includes(value);
}

/** What a rate reads as in a list. An unagreed rate says so; it never renders as "$0". */
export function supplierRateLabel(supplier: Pick<SupplierRecord, "rateKind" | "rateAmount">) {
  if (!supplier.rateAmount) return supplier.rateKind === "quote" ? "No quote yet" : "No rate agreed";
  const amount = `$${supplier.rateAmount.toLocaleString("en-US")}`;
  return supplier.rateKind === "quote" ? `${amount} quoted` : `${amount}/day`;
}

/** The refusal sentence for a create or edit, or undefined when it is good to save. */
export function supplierRefusal(input: { name: string; company: string; kind: SupplierKind; email: string; rateAmount: number }): string | undefined {
  // A vendor is a company, so a company name alone is enough for one; a contractor is a person.
  if (input.kind === "contractor" && !input.name.trim()) return "A contractor needs a name — who are you hiring?";
  if (input.kind === "vendor" && !input.name.trim() && !input.company.trim()) return "A vendor needs a company name.";
  if (input.email.trim() && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(input.email.trim())) return `"${input.email.trim()}" is not an email address.`;
  if (input.rateAmount < 0) return "A rate cannot be negative.";
  if (!Number.isFinite(input.rateAmount)) return "That rate is not a number.";
  return undefined;
}

export const SUPPLIER_CSV_COLUMNS = ["kind", "name", "company", "role_or_service", "email", "phone", "rate_kind", "rate_amount", "status", "events", "notes", "created_at", "updated_at"] as const;

/**
 * The CSV is exactly the rows the page is showing — same filter, same order, same event list. An
 * export that quietly widened to everything is how a "booked only" spreadsheet ends up with the
 * people we never hired in it.
 */
export function suppliersCsv(rows: Array<{ supplier: SupplierRecord; eventNames: string[] }>) {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [SUPPLIER_CSV_COLUMNS.join(",")];
  for (const { supplier, eventNames } of rows) {
    lines.push([
      supplier.kind,
      supplier.name,
      supplier.company,
      supplier.roleOrService,
      supplier.email,
      supplier.phone,
      supplier.rateKind,
      supplier.rateAmount,
      supplier.status,
      eventNames.join("; "),
      supplier.notes,
      supplier.createdAt,
      supplier.updatedAt,
    ].map(cell).join(","));
  }
  return `${lines.join("\n")}\n`;
}
