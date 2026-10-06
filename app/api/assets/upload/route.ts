import { NextResponse } from "next/server";
import { getAssetsBucket } from "@/lib/d1/binding";
import { verifyUploadUrl } from "@/services/assets/signedUrlService";
import { EVENT_ASSET_MAX_BYTES } from "@/types/eventAssets";

export const dynamic = "force-dynamic";

/**
 * The only way bytes enter the private R2 bucket. The link was minted by requestAssetUpload /
 * requestHouseLogoUpload after the caller's access was checked; this route checks the signature,
 * the expiry, the declared type and the size, then streams the body into R2. It never lists, never
 * overwrites a different key than the one signed, and never accepts more bytes than were declared.
 */
async function handle(request: Request) {
  const check = await verifyUploadUrl(new URL(request.url).searchParams).catch((error) => ({ ok: false as const, status: 403 as const, reason: error instanceof Error ? error.message : String(error) }));
  if (!check.ok) return NextResponse.json({ ok: false, error: check.reason }, { status: check.status });
  const bucket = getAssetsBucket();
  if (!bucket) return NextResponse.json({ ok: false, error: "File storage is not bound on this deployment (R2 binding ASSETS_BUCKET)." }, { status: 503 });
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (contentType !== check.mimeType) return NextResponse.json({ ok: false, error: `This link is for ${check.mimeType}, not ${contentType || "an unnamed type"}.` }, { status: 415 });
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return NextResponse.json({ ok: false, error: "That file is empty." }, { status: 400 });
  if (body.byteLength > check.sizeBytes || body.byteLength > EVENT_ASSET_MAX_BYTES) return NextResponse.json({ ok: false, error: "The file is larger than the upload link allows." }, { status: 413 });
  await bucket.put(check.key, body, { httpMetadata: { contentType: check.mimeType } });
  return NextResponse.json({ ok: true, key: check.key, sizeBytes: body.byteLength }, { headers: { "cache-control": "no-store" } });
}

export const PUT = handle;
export const POST = handle;
