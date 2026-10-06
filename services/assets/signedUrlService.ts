import { getEnv, getV5AccessCookieSecret } from "@/lib/env";
import { hmacSha256Base64Url } from "@/lib/security/portableCrypto";

/**
 * Signed links for the private R2 bucket (binding ASSETS_BUCKET). The bucket has no public URL;
 * bytes go in and out only through two Worker routes, and only with a link this module signed:
 *
 *   PUT /api/assets/upload?key=&mime=&size=&exp=&sig=   (upload, 10 minutes)
 *   GET /api/assets/file?key=&exp=&sig=                 (download, 10 minutes / logo 1 hour)
 *
 * The signature is HMAC-SHA256 over the operation and every parameter, keyed with the same
 * V5_ACCESS_COOKIE_SECRET the access cookies use, so a link cannot be widened (another key, a bigger
 * size, a later expiry) without breaking it, and an expired one is refused even with a good signature.
 */
export interface SignedStorageRequest {
  bucketName: string;
  storagePath: string;
  expiresInSeconds: number;
}

export interface SignedUploadResponse extends SignedStorageRequest {
  signedUrl: string;
  path: string;
  mode: "r2-signed-upload";
}

export interface SignedDownloadResponse extends SignedStorageRequest {
  signedUrl: string;
  path: string;
  mode: "r2-signed-download";
}

export function buildSignedUploadRequest(input: { bucketName: string; storagePath: string; expiresInSeconds?: number }): SignedStorageRequest {
  return { bucketName: input.bucketName, storagePath: input.storagePath, expiresInSeconds: input.expiresInSeconds ?? 60 * 10 };
}

export function buildSignedDownloadRequest(input: { bucketName: string; storagePath: string; expiresInSeconds?: number }): SignedStorageRequest {
  return { bucketName: input.bucketName, storagePath: input.storagePath, expiresInSeconds: input.expiresInSeconds ?? 60 * 60 };
}

function signingSecret(secret?: string) {
  const value = secret ?? getV5AccessCookieSecret(getEnv());
  if (!value) throw new Error("V5_ACCESS_COOKIE_SECRET is not set, so no storage link can be signed.");
  return value;
}

function uploadMessage(key: string, mime: string, size: number, exp: number) {
  return `r2-put\n${key}\n${mime}\n${size}\n${exp}`;
}

function downloadMessage(key: string, exp: number) {
  return `r2-get\n${key}\n${exp}`;
}

/** Constant-time compare of two signatures. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signUploadUrl(input: { key: string; mimeType: string; sizeBytes: number; expiresInSeconds?: number; now?: number; secret?: string }) {
  const exp = Math.floor((input.now ?? Date.now()) / 1000) + (input.expiresInSeconds ?? 60 * 10);
  const sig = await hmacSha256Base64Url(uploadMessage(input.key, input.mimeType, input.sizeBytes, exp), signingSecret(input.secret));
  const params = new URLSearchParams({ key: input.key, mime: input.mimeType, size: String(input.sizeBytes), exp: String(exp), sig });
  return `/api/assets/upload?${params.toString()}`;
}

export async function signDownloadUrl(input: { key: string; expiresInSeconds?: number; now?: number; secret?: string }) {
  const exp = Math.floor((input.now ?? Date.now()) / 1000) + (input.expiresInSeconds ?? 60 * 10);
  const sig = await hmacSha256Base64Url(downloadMessage(input.key, exp), signingSecret(input.secret));
  const params = new URLSearchParams({ key: input.key, exp: String(exp), sig });
  return `/api/assets/file?${params.toString()}`;
}

export type SignedLinkCheck<T> = ({ ok: true } & T) | { ok: false; status: 400 | 403 | 410; reason: string };

export async function verifyUploadUrl(params: URLSearchParams, options: { now?: number; secret?: string } = {}): Promise<SignedLinkCheck<{ key: string; mimeType: string; sizeBytes: number }>> {
  const key = params.get("key") || "";
  const mime = params.get("mime") || "";
  const size = Number(params.get("size"));
  const exp = Number(params.get("exp"));
  const sig = params.get("sig") || "";
  if (!key || !mime || !Number.isFinite(size) || size <= 0 || !Number.isFinite(exp) || !sig) return { ok: false, status: 400, reason: "That upload link is incomplete." };
  const expected = await hmacSha256Base64Url(uploadMessage(key, mime, size, exp), signingSecret(options.secret));
  if (!same(sig, expected)) return { ok: false, status: 403, reason: "That upload link was not signed by this site." };
  if (Math.floor((options.now ?? Date.now()) / 1000) > exp) return { ok: false, status: 410, reason: "That upload link has expired. Start the upload again." };
  return { ok: true, key, mimeType: mime, sizeBytes: size };
}

export async function verifyDownloadUrl(params: URLSearchParams, options: { now?: number; secret?: string } = {}): Promise<SignedLinkCheck<{ key: string }>> {
  const key = params.get("key") || "";
  const exp = Number(params.get("exp"));
  const sig = params.get("sig") || "";
  if (!key || !Number.isFinite(exp) || !sig) return { ok: false, status: 400, reason: "That file link is incomplete." };
  const expected = await hmacSha256Base64Url(downloadMessage(key, exp), signingSecret(options.secret));
  if (!same(sig, expected)) return { ok: false, status: 403, reason: "That file link was not signed by this site." };
  if (Math.floor((options.now ?? Date.now()) / 1000) > exp) return { ok: false, status: 410, reason: "That file link has expired. Open the file again from the library." };
  return { ok: true, key };
}
