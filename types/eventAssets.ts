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

/**
 * SVG is not taken: an SVG is a document that can carry script, and anyone holding its link could
 * open it as a page. PNG, JPEG, WebP and GIF cover logos and slides.
 */
export const EVENT_ASSET_ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "text/plain",
  "text/csv",
  "text/markdown",
];

/** Types the file route lets a browser show in place; anything else is sent as a download. */
export const ASSET_INLINE_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "video/mp4"];

function baseMime(contentType: string) {
  return contentType.split(";")[0].trim().toLowerCase();
}

export function assetOpensInline(contentType: string) {
  return ASSET_INLINE_MIME.includes(baseMime(contentType));
}

/**
 * Everything is sandboxed with no sources, except PDF and MP4: browsers will not run their PDF viewer
 * or their video player in a sandboxed document (Chrome shows a dead player at 0:00). Neither runs
 * page script on this origin: a PDF's scripts stay inside the viewer, a media document has none, and
 * nosniff keeps the bytes from ever being read as HTML. MP4 keeps its sources locked to this origin.
 */
export function assetFileCsp(contentType: string) {
  const mime = baseMime(contentType);
  if (mime === "application/pdf") return "frame-ancestors 'self'";
  if (mime === "video/mp4") return "default-src 'none'; media-src 'self'; frame-ancestors 'self'";
  return "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'";
}

export function assetSizeLabel(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/**
 * Where a file is being added, so a refusal only offers what that screen has: the producer's library
 * has a paste-a-link form, a speaker's or sponsor's portal and the house-logo setting do not.
 */
export type AssetUploadPlace = "library" | "portal" | "logo";

const ACCEPTED_NAMES = "PDF, PowerPoint, Word, Excel, PNG, JPG, WebP, GIF, MP4 or a text file";
const LOGO_NAMES = "PNG, JPG, WebP or GIF";

function isSvg(mimeType: string, fileName?: string) {
  return baseMime(mimeType) === "image/svg+xml" || /\.svgz?$/i.test(fileName || "");
}

export function assetUploadRefusal(input: { mimeType: string; sizeBytes: number; fileName?: string; place?: AssetUploadPlace }): string | undefined {
  const place = input.place || "portal";
  const orLink = place === "library" ? " Or paste a link to it instead." : "";
  if (input.sizeBytes > EVENT_ASSET_MAX_BYTES) {
    const size = `That file is ${assetSizeLabel(input.sizeBytes)}; the limit is ${assetSizeLabel(EVENT_ASSET_MAX_BYTES)}.`;
    return place === "library" ? `${size} Paste a link to it instead.` : `${size} Save a smaller copy and upload that.`;
  }
  if (!input.sizeBytes) return "That file is empty. Choose the file again.";
  if (isSvg(input.mimeType, input.fileName)) {
    return place === "logo"
      ? "SVG logos can't be uploaded. Save the logo as a PNG and upload that."
      : `SVG files can't be uploaded. Save it as a PNG or PDF and upload that.${orLink}`;
  }
  const allowed = place === "logo" ? ["image/png", "image/jpeg", "image/webp", "image/gif"] : EVENT_ASSET_ALLOWED_MIME;
  if (input.mimeType && !allowed.includes(input.mimeType)) {
    return place === "logo"
      ? `That kind of file can't be a logo. Save it as ${LOGO_NAMES} and upload that.`
      : `That kind of file can't be uploaded. Save it as ${ACCEPTED_NAMES} and upload that.${orLink}`;
  }
  return undefined;
}
