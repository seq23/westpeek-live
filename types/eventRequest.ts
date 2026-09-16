/**
 * A request to have West Peek run an event, from the public form to the money being in.
 *
 * One row, one list. The request that arrives at /request-event is the same row the owner prices,
 * the same row the client confirms, and the same row that records what was sent when it was paid —
 * there is no second table shadowing the first.
 */
export type EventRequestState = "requested" | "approved" | "confirmed" | "paid" | "declined";

/** How money actually arrived. `manual` is West Peek marking it settled; a provider adds its own. */
export type SettlementMethod = "manual" | "stripe";

export interface EventRequestRecord {
  id: string;
  name: string;
  email: string;
  company?: string;
  eventType?: string;
  eventDate?: string;
  audienceSize?: string;
  livestreamNeeds?: string;
  networkingNeeds?: string;
  sponsorExpoNeeds?: string;
  speakerCount?: string;
  supportLevel?: string;
  notes?: string;
  /** Required on the form since 16 Sep 2026: a band, never a number the visitor has to invent. */
  budgetRange?: string;
  state: EventRequestState;
  /** What West Peek said it would do, in the owner's words. Written when the price is attached. */
  scopeSummary?: string;
  /** Cents, so nothing is ever a float. Undefined until the request is priced. */
  priceAmountCents?: number;
  priceCurrency?: string;
  /** The client's link to the scope. Minted at approval, never guessable, never reused. */
  confirmToken?: string;
  /** The draft event this request became, so the codes in the instructions are that event's codes. */
  eventId?: string;
  approvedAt?: string;
  approvedBy?: string;
  confirmedAt?: string;
  paidAt?: string;
  paidBy?: string;
  settlementMethod?: SettlementMethod;
  /** A cheque number, a wire reference, or one day a provider's payment id. */
  settlementReference?: string;
  /** When the instruction emails went out. One timestamp; the send log holds the detail. */
  instructionsSentAt?: string;
  declinedAt?: string;
  declineReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRange {
  value: string;
  label: string;
}

/**
 * The bands the form offers. Bands rather than a free number: a visitor who has to type a figure
 * either guesses low or leaves. "Not sure yet" is a real answer and is allowed to be one.
 */
export const BUDGET_RANGES: BudgetRange[] = [
  { value: "under_10k", label: "Under $10,000" },
  { value: "10k_25k", label: "$10,000 to $25,000" },
  { value: "25k_50k", label: "$25,000 to $50,000" },
  { value: "50k_100k", label: "$50,000 to $100,000" },
  { value: "over_100k", label: "Over $100,000" },
  { value: "not_sure", label: "Not sure yet" },
];

export function budgetRangeLabel(value: string | undefined) {
  return BUDGET_RANGES.find((range) => range.value === value)?.label || value || "Not given";
}

export function isBudgetRange(value: string | undefined): boolean {
  return BUDGET_RANGES.some((range) => range.value === value);
}

/** What each state means on the workspace list, in one line, so nobody has to guess. */
export const EVENT_REQUEST_STATE_LABELS: Record<EventRequestState, string> = {
  requested: "Came in, not priced yet",
  approved: "Priced and sent to the client",
  confirmed: "Client confirmed the scope, not paid",
  paid: "Paid, instructions out",
  declined: "Declined",
};

export function formatPrice(amountCents: number | undefined, currency = "USD") {
  if (typeof amountCents !== "number") return "No price yet";
  const whole = amountCents / 100;
  return `${currency === "USD" ? "$" : `${currency} `}${whole.toLocaleString("en-US", { minimumFractionDigits: whole % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
