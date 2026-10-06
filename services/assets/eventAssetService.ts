import { randomId } from "@/lib/security/portableCrypto";
import { getAssetsBucket } from "@/lib/d1/binding";
import { signDownloadUrl, signUploadUrl } from "./signedUrlService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { EVENT_ASSET_BUCKET, assetUploadRefusal, type EventAssetRecord, type EventAssetStatus, type EventAssetUploaderKind, type EventAssetVisibility } from "@/types/eventAssets";

/**
 * Real files for an event, in the private R2 bucket (binding ASSETS_BUCKET). The server mints a
 * short-lived signed upload link to this Worker's own /api/assets/upload route, the browser PUTs the
 * bytes there and the route streams them into R2; the row is written only once the object is
 * confirmed in the bucket. Downloads are signed on demand and expire. Storage that is not bound says
 * so in words rather than failing silently.
 */
export interface UploadTicket {
  ok: true;
  assetId: string;
  signedUrl: string;
  token: string;
  storagePath: string;
  bucket: string;
}

export interface UploadRefusal {
  ok: false;
  reason: string;
}

function storagePathFor(eventId: string, assetId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  return `${eventId}/${assetId}/${safe}`;
}

const NOT_BOUND = "File storage is not bound on this deployment (R2 binding ASSETS_BUCKET).";

async function uploadTicket(storagePath: string, assetId: string, mimeType: string, sizeBytes: number): Promise<UploadTicket | UploadRefusal> {
  try {
    const signedUrl = await signUploadUrl({ key: storagePath, mimeType, sizeBytes });
    return { ok: true, assetId, signedUrl, token: "", storagePath, bucket: EVENT_ASSET_BUCKET };
  } catch (error) {
    return { ok: false, reason: `Storage could not sign the upload: ${error instanceof Error ? error.message : String(error)}.` };
  }
}

/** True only when the bytes are really in the bucket: a confirm for an object that never arrived is refused. */
export async function storedObjectExists(storagePath: string) {
  const bucket = getAssetsBucket();
  if (!bucket) return false;
  return Boolean(await bucket.head(storagePath));
}

export async function requestAssetUpload(input: {
  eventId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<UploadTicket | UploadRefusal> {
  const refusal = assetUploadRefusal({ mimeType: input.mimeType, sizeBytes: input.sizeBytes });
  if (refusal) return { ok: false, reason: refusal };
  if (!getAssetsBucket()) return { ok: false, reason: `${NOT_BOUND} Paste a link to the file instead.` };
  const assetId = randomId("asset");
  const storagePath = storagePathFor(input.eventId, assetId, input.fileName);
  return uploadTicket(storagePath, assetId, input.mimeType, input.sizeBytes);
}

/**
 * The house logo: the same private bucket, the same signed-upload dance, no event and no asset row.
 *
 * It reuses this module's storage helpers on purpose — a second upload path would be a second set
 * of bucket-creation, refusal and signed-URL bugs. What it does NOT do is write an EventAssetRecord:
 * the logo belongs to the agency, not to an event, so it can never appear in a library or move an
 * event's file count.
 */
export const HOUSE_LOGO_PREFIX = "house/logo";

export async function requestHouseLogoUpload(input: { fileName: string; mimeType: string; sizeBytes: number }): Promise<UploadTicket | UploadRefusal> {
  const refusal = assetUploadRefusal({ mimeType: input.mimeType, sizeBytes: input.sizeBytes });
  if (refusal) return { ok: false, reason: refusal };
  if (!input.mimeType.startsWith("image/")) return { ok: false, reason: "A logo has to be an image — PNG, JPG or SVG." };
  if (!getAssetsBucket()) return { ok: false, reason: `${NOT_BOUND} A logo cannot be uploaded; the wordmark stays.` };
  const assetId = randomId("logo");
  const storagePath = storagePathFor(HOUSE_LOGO_PREFIX, assetId, input.fileName);
  return uploadTicket(storagePath, assetId, input.mimeType, input.sizeBytes);
}

/** A one-hour signed URL for the stored logo, or nothing — in which case the wordmark renders. */
export async function houseLogoUrl(storagePath: string): Promise<string | undefined> {
  if (!storagePath) return undefined;
  if (!getAssetsBucket()) return undefined;
  return signDownloadUrl({ key: storagePath, expiresInSeconds: 60 * 60 }).catch(() => undefined);
}

export async function recordUploadedAsset(input: {
  eventId: string;
  assetId: string;
  storagePath?: string;
  externalUrl?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByKind: EventAssetUploaderKind;
  uploadedByLabel: string;
  visibility?: EventAssetVisibility;
  note?: string;
}) {
  const now = new Date().toISOString();
  const asset: EventAssetRecord = {
    id: input.assetId,
    eventId: input.eventId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storagePath: input.storagePath,
    externalUrl: input.externalUrl,
    uploadedByKind: input.uploadedByKind,
    uploadedByLabel: input.uploadedByLabel,
    // A guest's file waits for the crew; production's own upload starts where it is.
    visibility: input.visibility || "internal",
    status: input.uploadedByKind === "speaker" || input.uploadedByKind === "sponsor" ? "in_review" : "uploaded",
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };
  return getRuntimeStore().upsertEventAsset(asset);
}

export async function listEventAssets(eventId: string, options: { includeArchived?: boolean; clientFacingOnly?: boolean } = {}) {
  const assets = await getRuntimeStore().listEventAssets(eventId, options.includeArchived).catch(() => [] as EventAssetRecord[]);
  return options.clientFacingOnly ? assets.filter((asset) => asset.visibility === "client_facing" && asset.status === "approved") : assets;
}

export async function listAssetsAcrossEvents(includeArchived = false) {
  return getRuntimeStore().listAllEventAssets(includeArchived).catch(() => [] as EventAssetRecord[]);
}

export async function setAssetReview(assetId: string, status: EventAssetStatus, reviewedBy: string) {
  const store = getRuntimeStore();
  const asset = await store.getEventAsset(assetId);
  if (!asset) return undefined;
  const now = new Date().toISOString();
  return store.upsertEventAsset({ ...asset, status, reviewedBy, reviewedAt: now, updatedAt: now });
}

export async function setAssetVisibility(assetId: string, visibility: EventAssetVisibility) {
  const store = getRuntimeStore();
  const asset = await store.getEventAsset(assetId);
  if (!asset) return undefined;
  return store.upsertEventAsset({ ...asset, visibility, updatedAt: new Date().toISOString() });
}

/** Archive, never delete: the row and the object both stay; the library stops listing it. */
export async function archiveAsset(assetId: string, by: string) {
  const store = getRuntimeStore();
  const asset = await store.getEventAsset(assetId);
  if (!asset) return undefined;
  const now = new Date().toISOString();
  return store.upsertEventAsset({ ...asset, archivedAt: now, reviewedBy: by, updatedAt: now });
}

export async function assetDownloadUrl(assetId: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const asset = await getRuntimeStore().getEventAsset(assetId);
  if (!asset) return { ok: false, reason: "That file is not in the library." };
  if (asset.externalUrl) return { ok: true, url: asset.externalUrl };
  if (!asset.storagePath) return { ok: false, reason: "That row has no file behind it." };
  if (!getAssetsBucket()) return { ok: false, reason: NOT_BOUND };
  try {
    return { ok: true, url: await signDownloadUrl({ key: asset.storagePath, expiresInSeconds: 60 * 10 }) };
  } catch (error) {
    return { ok: false, reason: `Storage could not sign the download: ${error instanceof Error ? error.message : String(error)}` };
  }
}
