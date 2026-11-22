import { NextResponse } from "next/server";
import { getAssetsBucket } from "@/lib/d1/binding";
import { verifyDownloadUrl } from "@/services/assets/signedUrlService";
import { assetFileCsp, assetOpensInline } from "@/types/eventAssets";

export const dynamic = "force-dynamic";

/**
 * The only way bytes leave the private R2 bucket: a link signed by assetDownloadUrl (after
 * /api/assets/[assetId]/download checked who is asking) or by houseLogoUrl. Expired, tampered or
 * unsigned links are refused; the object itself is never public.
 *
 * A stored file is someone's upload, so it is never run as a page on this origin: every response is
 * sandboxed with no sources allowed (PDF and MP4 aside, see assetFileCsp), and only images (SVG
 * included, sandboxed so its script never runs), PDF and MP4 open in the browser; every other type
 * (Word, PowerPoint, Excel, text) is sent as a download.
 */
export async function GET(request: Request) {
  const check = await verifyDownloadUrl(new URL(request.url).searchParams).catch((error) => ({ ok: false as const, status: 403 as const, reason: error instanceof Error ? error.message : String(error) }));
  if (!check.ok) return NextResponse.json({ ok: false, error: check.reason }, { status: check.status });
  const bucket = getAssetsBucket();
  if (!bucket) return NextResponse.json({ ok: false, error: "File storage is not bound on this deployment (R2 binding ASSETS_BUCKET)." }, { status: 503 });
  const object = await bucket.get(check.key);
  if (!object) return NextResponse.json({ ok: false, error: "That file is not in storage." }, { status: 404 });
  const fileName = (check.key.split("/").pop() || "file").replace(/["\\\r\n]/g, "");
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  const inline = assetOpensInline(contentType);
  return new Response(object.body, {
    headers: {
      "content-type": contentType,
      "content-length": String(object.size),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
      "content-security-policy": assetFileCsp(contentType),
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
