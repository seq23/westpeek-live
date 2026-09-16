"use server";

import { revalidatePath } from "next/cache";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";
import { archiveAsset, recordUploadedAsset, requestAssetUpload, setAssetReview, setAssetVisibility } from "@/services/assets/eventAssetService";
import type { EventAssetStatus, EventAssetVisibility } from "@/types/eventAssets";

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
 * a short-lived signed URL straight to Supabase Storage. The browser PUTs the bytes itself, so a
 * 40 MB deck never passes through the Worker.
 */
export async function requestAssetUploadAction(input: { eventId: string; fileName: string; mimeType: string; sizeBytes: number }) {
  const actor = await getWorkspaceActor();
  const guest = actor ? undefined : await guestUploader(input.eventId);
  if (!actor && !guest) {
    try { await requireAssetControl(input.eventId); } catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "You cannot add files to this event." }; }
  }
  return requestAssetUpload(input);
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
  const asset = await recordUploadedAsset({ ...input, uploadedByKind, uploadedByLabel });
  revalidateAssetSurfaces(input.eventId);
  return { ok: true as const, assetId: asset.id };
}

/** Production pastes a link when the file lives somewhere else (or storage is not configured). */
export async function addAssetLinkAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const url = clean(formData.get("url"));
  if (!eventId || !url) return;
  const actor = await getWorkspaceActor();
  const label = actor ? actor.label : await requireAssetControl(eventId);
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
