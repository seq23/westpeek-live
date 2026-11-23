"use server";

import { revalidatePath } from "next/cache";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { archiveAsset, recordUploadedAsset, requestAssetUpload, setAssetReview, setAssetVisibility, storedObjectExists } from "@/services/assets/eventAssetService";
import { ASSET_LINK_REFUSAL, httpsAssetLink, type EventAssetStatus, type EventAssetVisibility } from "@/types/eventAssets";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function revalidateAssetSurfaces(eventId: string) {
  for (const path of [`/app/events/${eventId}/assets`, "/app/assets", `/app/events/${eventId}`, `/speaker/events/${eventId}/green-room`, `/sponsor/events/${eventId}/booth`]) revalidatePath(path);
}

/** Crew, operator or owner: the people who run the event. Throws the deck's own sentence when refused. */
async function requireAssetControl(eventId: string) {
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_assets");
  if (!auth.ok) throw new Error(auth.error);
  return auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
}

/** A speaker or sponsor uploading to their own event, identified by their guest cookie. */
async function guestUploader(eventId: string) {
  for (const role of ["speaker", "sponsor"] as const) {
    const identity = await getCurrentGuestIdentity(eventId, role).catch(() => undefined);
    if (identity) return { kind: role, label: identity.name || `A ${role}` };
  }
  return undefined;
}

/**
 * Step one of a real upload: the server checks who is asking and what they are sending, then mints
 * a short-lived signed link to /api/assets/upload, which streams the bytes into the private R2 bucket.
 */
export async function requestAssetUploadAction(input: { eventId: string; fileName: string; mimeType: string; sizeBytes: number; place?: "library" | "portal" }) {
  const actor = await getWorkspaceActor();
  const guest = actor ? undefined : await guestUploader(input.eventId);
  if (!actor && !guest) {
    try { await requireAssetControl(input.eventId); } catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "You cannot add files to this event." }; }
  }
  // Only the crew's library has a link form; a guest is always told the portal's next step.
  return requestAssetUpload({ ...input, place: guest ? "portal" : input.place });
}

/** Step two: the bytes are in the bucket, so the row goes in the library. */
export async function confirmAssetUploadAction(input: { eventId: string; assetId: string; storagePath: string; fileName: string; mimeType: string; sizeBytes: number; note?: string }) {
  const actor = await getWorkspaceActor();
  const guest = actor ? undefined : await guestUploader(input.eventId);
  let uploadedByKind: "owner" | "operator" | "crew" | "speaker" | "sponsor";
  let uploadedByLabel: string;
  if (actor) {
    uploadedByKind = actor.kind === "owner" ? "owner" : "operator";
    uploadedByLabel = actor.label;
  } else if (guest) {
    uploadedByKind = guest.kind;
    uploadedByLabel = guest.label;
  } else {
    const who = await requireAssetControl(input.eventId);
    uploadedByKind = "crew";
    uploadedByLabel = who;
  }
  // The row is written only for an object that is really in the bucket, under this event's prefix.
  if (!input.storagePath.startsWith(`${input.eventId}/${input.assetId}/`)) return { ok: false as const, reason: "That upload does not belong to this event." };
  if (!(await storedObjectExists(input.storagePath))) return { ok: false as const, reason: "The file never reached storage. Upload it again." };
  const asset = await recordUploadedAsset({ ...input, uploadedByKind, uploadedByLabel });
  revalidateAssetSurfaces(input.eventId);
  return { ok: true as const, assetId: asset.id };
}

/** What the link form shows after a submit: nothing yet, saved, or the refusal sentence (with what was typed, so it can be fixed in place). */
export type AssetLinkResult = { ok: true } | { ok: false; message: string; pasted: string } | undefined;

/**
 * Production pastes a link when the file lives somewhere else (or storage is not configured).
 * Used with useActionState: a refusal comes back as a message for the form, never a thrown error,
 * which would replace the page with the error screen.
 */
export async function addAssetLinkAction(_previous: AssetLinkResult, formData: FormData): Promise<AssetLinkResult> {
  const eventId = clean(formData.get("eventId"));
  const pasted = clean(formData.get("url"));
  if (!eventId || !pasted) return { ok: false, message: ASSET_LINK_REFUSAL, pasted };
  const actor = await getWorkspaceActor();
  let label: string;
  try { label = actor ? actor.label : await requireAssetControl(eventId); }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "You cannot add files to this event.", pasted }; }
  const url = httpsAssetLink(pasted);
  if (!url) return { ok: false, message: ASSET_LINK_REFUSAL, pasted };
  await recordUploadedAsset({
    eventId,
    assetId: `asset-link-${Date.now()}`,
    externalUrl: url,
    fileName: clean(formData.get("fileName")) || url.split("/").pop() || "Linked file",
    mimeType: "text/uri-list",
    sizeBytes: 0,
    uploadedByKind: actor?.kind === "owner" ? "owner" : "operator",
    uploadedByLabel: label,
    note: clean(formData.get("note")) || undefined,
  });
  revalidateAssetSurfaces(eventId);
  return { ok: true };
}

export async function reviewAssetAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const assetId = clean(formData.get("assetId"));
  const status = clean(formData.get("status")) as EventAssetStatus;
  if (!eventId || !assetId || !["uploaded", "in_review", "approved", "changes_requested"].includes(status)) return;
  const who = await requireAssetControl(eventId);
  await setAssetReview(assetId, status, who);
  revalidateAssetSurfaces(eventId);
}

export async function setAssetVisibilityAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const assetId = clean(formData.get("assetId"));
  const visibility = clean(formData.get("visibility")) as EventAssetVisibility;
  if (!eventId || !assetId || !["internal", "client_facing"].includes(visibility)) return;
  await requireAssetControl(eventId);
  await setAssetVisibility(assetId, visibility);
  revalidateAssetSurfaces(eventId);
}

/** Archive is the only removal: the row and the file both stay. */
export async function archiveAssetAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const assetId = clean(formData.get("assetId"));
  if (!eventId || !assetId) return;
  const who = await requireAssetControl(eventId);
  await archiveAsset(assetId, who);
  revalidateAssetSurfaces(eventId);
}
