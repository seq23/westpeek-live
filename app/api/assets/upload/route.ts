import { NextResponse } from "next/server";
import { getAssetsBucket } from "@/lib/d1/binding";
import { verifyUploadUrl } from "@/services/assets/signedUrlService";
import { EVENT_ASSET_MAX_BYTES } from "@/types/eventAssets";

export const dynamic = "force-dynamic";

/**
 * The only way bytes enter the private R2 bucket. The link was minted by requestAssetUpload /
 * requestHouseLogoUpload after the caller's access was checked; this route checks the signature,
 * the expiry, the declared type and the size, then puts the body into R2. It never lists, never
 * overwrites a different key than the one signed, and never accepts more bytes than were declared:
 * a Content-Length over the limit is refused before anything is read, and the body is read with a
 * running count that stops at the limit, so a client that lies about its length is still capped on
 * the bytes it really sends and never makes the Worker hold more than the link allows.
 */
async function handle(request: Request) {
  const check = await verifyUploadUrl(new URL(request.url).searchParams).catch((error) => ({ ok: false as const, status: 403 as const, reason: error instanceof Error ? error.message : String(error) }));
  if (!check.ok) return NextResponse.json({ ok: false, error: check.reason }, { status: check.status });
  const bucket = getAssetsBucket();
  if (!bucket) return NextResponse.json({ ok: false, error: "File storage is not bound on this deployment (R2 binding ASSETS_BUCKET)." }, { status: 503 });
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (contentType !== check.mimeType) return NextResponse.json({ ok: false, error: `This link is for ${check.mimeType}, not ${contentType || "an unnamed type"}.` }, { status: 415 });
  const limit = Math.min(check.sizeBytes, EVENT_ASSET_MAX_BYTES);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return tooLarge();
  const body = await readUpTo(request, limit);
  if (body === "too_large") return tooLarge();
  if (body.byteLength === 0) return NextResponse.json({ ok: false, error: "That file is empty." }, { status: 400 });
  try {
    await bucket.put(check.key, body, { httpMetadata: { contentType: check.mimeType } });
  } catch (error) {
    // Nothing is recorded yet: the library row is written only after the object is found in the
    // bucket (confirmAssetUploadAction), so a failed put leaves no half record behind.
    console.error(`[assets/upload] R2 put failed for ${check.key}:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Storage did not accept the file, so nothing was saved. Try the upload again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, key: check.key, sizeBytes: body.byteLength }, { headers: { "cache-control": "no-store" } });
}

function tooLarge() {
  return NextResponse.json({ ok: false, error: "The file is larger than the upload link allows." }, { status: 413 });
}

/** The body, read until it ends or passes `limit` bytes; past the limit the read is cancelled. */
async function readUpTo(request: Request, limit: number): Promise<Uint8Array | "too_large"> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return "too_large";
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export const PUT = handle;
export const POST = handle;
