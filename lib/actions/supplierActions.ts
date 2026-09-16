"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspaceActor, WorkspaceActorRequiredError } from "@/lib/auth/workspaceActor";
import { isRuntimeSchemaMissing } from "@/services/events/eventRepository";
import { archiveSupplier, attachSupplierToEvent, createSupplier, detachSupplierFromEvent, setSupplierStatus, updateSupplier } from "@/services/suppliers/supplierRepository";
import { isSupplierKind, isSupplierStatus, type SupplierKind, type SupplierStatus } from "@/types/suppliers";

/**
 * Every write behind the Contractors and Vendors pages. Each one is the owner's or operator's, is
 * refused in the same words the form shows, and sends the owner back to the page they were on with
 * the reason in the query string rather than onto a blank error screen.
 */
function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function kindOf(formData: FormData): SupplierKind {
  const raw = field(formData, "kind");
  return isSupplierKind(raw) ? raw : "contractor";
}

/** Where the owner came from: an event's own page, or the global list for that kind. */
function returnTo(formData: FormData, kind: SupplierKind) {
  const explicit = field(formData, "returnTo");
  if (explicit.startsWith("/app/")) return explicit;
  return kind === "vendor" ? "/app/vendors" : "/app/contractors";
}

function failureRedirect(base: string, error: unknown): never {
  if (error instanceof WorkspaceActorRequiredError) redirect(`/production-access/owner?next=${encodeURIComponent(base)}`);
  if (isRuntimeSchemaMissing(error)) redirect(`${base}${base.includes("?") ? "&" : "?"}error=schema_missing`);
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message.slice(0, 160))}`);
}

function revalidateSupplierSurfaces(eventId?: string) {
  for (const path of ["/app/contractors", "/app/vendors"]) revalidatePath(path);
  if (eventId) for (const path of [`/app/events/${eventId}/talent`, `/app/events/${eventId}/vendors`]) revalidatePath(path);
}

function inputFrom(formData: FormData, kind: SupplierKind) {
  const rawStatus = field(formData, "status");
  const rawRate = field(formData, "rateAmount").replace(/[$,\s]/g, "");
  return {
    kind,
    name: field(formData, "name"),
    company: field(formData, "company"),
    roleOrService: field(formData, "roleOrService"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    // A vendor quotes the job, a contractor is hired by the day, unless the form says otherwise.
    rateKind: field(formData, "rateKind") === "quote" ? ("quote" as const) : field(formData, "rateKind") === "day_rate" ? ("day_rate" as const) : undefined,
    rateAmount: rawRate ? Number(rawRate) : 0,
    notes: field(formData, "notes"),
    status: isSupplierStatus(rawStatus) ? (rawStatus as SupplierStatus) : undefined,
  };
}

export async function createSupplierAction(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const base = returnTo(formData, kind);
  let destination = base;
  try {
    await requireWorkspaceActor();
    const supplier = await createSupplier(inputFrom(formData, kind));
    // Created from an event page? Put them straight on that event — that is why she opened the form.
    const eventId = field(formData, "eventId");
    if (eventId) await attachSupplierToEvent(supplier.id, eventId, field(formData, "eventNote"));
    revalidateSupplierSurfaces(eventId || undefined);
    destination = `${base}${base.includes("?") ? "&" : "?"}added=${encodeURIComponent(supplier.name)}`;
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(destination);
}

export async function updateSupplierAction(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const base = returnTo(formData, kind);
  const supplierId = field(formData, "supplierId");
  try {
    await requireWorkspaceActor();
    if (!supplierId) throw new Error("That row no longer exists.");
    const updated = await updateSupplier(supplierId, inputFrom(formData, kind));
    if (!updated) throw new Error("That row no longer exists.");
    revalidateSupplierSurfaces(field(formData, "eventId") || undefined);
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(`${base}${base.includes("?") ? "&" : "?"}saved=${encodeURIComponent(supplierId)}`);
}

export async function setSupplierStatusAction(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const base = returnTo(formData, kind);
  const status = field(formData, "status");
  try {
    await requireWorkspaceActor();
    if (!isSupplierStatus(status)) throw new Error("That is not a status we keep.");
    await setSupplierStatus(field(formData, "supplierId"), status);
    revalidateSupplierSurfaces(field(formData, "eventId") || undefined);
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(base);
}

/** Archive is the only removal, and it leaves every event they worked on the record. */
export async function archiveSupplierAction(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const base = returnTo(formData, kind);
  try {
    await requireWorkspaceActor();
    await archiveSupplier(field(formData, "supplierId"));
    revalidateSupplierSurfaces(field(formData, "eventId") || undefined);
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(base);
}

export async function attachSupplierAction(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const base = returnTo(formData, kind);
  const eventId = field(formData, "eventId");
  try {
    await requireWorkspaceActor();
    const supplierId = field(formData, "supplierId");
    if (!supplierId) throw new Error(`Choose a ${kind} to add to this event.`);
    if (!eventId) throw new Error("That event no longer exists.");
    const link = await attachSupplierToEvent(supplierId, eventId, field(formData, "eventNote"));
    if (!link) throw new Error("That row no longer exists.");
    revalidateSupplierSurfaces(eventId);
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(base);
}

export async function detachSupplierAction(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const base = returnTo(formData, kind);
  const eventId = field(formData, "eventId");
  try {
    await requireWorkspaceActor();
    await detachSupplierFromEvent(field(formData, "supplierId"), eventId);
    revalidateSupplierSurfaces(eventId);
  } catch (error) {
    failureRedirect(base, error);
  }
  redirect(base);
}
