/**
 * A file that belongs to an event: a deck, a logo, a graphic, a contract. Uploaded by production or
 * by the speaker or sponsor themselves, reviewed by the crew, and either kept internal or shown to
 * the client. Archiving is the only removal.
 */
export type EventAssetVisibility = "internal" | "client_facing";
export type EventAssetStatus = "uploaded" | "in_review" | "approved" | "changes_requested";
export type EventAssetUploaderKind = "owner" | "operator" | "crew" | "speaker" | "sponsor";

export interface EventAssetRecord {
  id: string;
  eventId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** The object inside the private bucket. Undefined when the asset is a pasted link. */
  storagePath?: string;
  /** Set when production pasted a link instead of uploading a file. */
  externalUrl?: string;
  uploadedByKind: EventAssetUploaderKind;
  uploadedByLabel: string;
  visibility: EventAssetVisibility;
  status: EventAssetStatus;
  note?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const EVENT_ASSET_BUCKET = "event-assets";

/** 50 MB: bigger than any deck we have been sent, small enough that a Worker request never stalls. */
export const EVENT_ASSET_MAX_BYTES = 50_000_000;

export const EVENT_ASSET_ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "video/mp4",
  "text/plain",
  "text/csv",
  "text/markdown",
];

export function assetSizeLabel(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

export function assetUploadRefusal(input: { mimeType: string; sizeBytes: number }): string | undefined {
  if (input.sizeBytes > EVENT_ASSET_MAX_BYTES) return `That file is ${assetSizeLabel(input.sizeBytes)}; the limit is ${assetSizeLabel(EVENT_ASSET_MAX_BYTES)}. Send a link instead.`;
  if (!input.sizeBytes) return "That file is empty.";
  if (input.mimeType && !EVENT_ASSET_ALLOWED_MIME.includes(input.mimeType)) return `We do not take ${input.mimeType} files. Decks, documents, images, MP4 video and plain text — or paste a link.`;
  return undefined;
}
