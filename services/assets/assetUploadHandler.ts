import { verifyUploadUrl } from "./signedUrlService";
import { EVENT_ASSET_MAX_BYTES } from "@/types/eventAssets";
import type { R2BucketLike } from "@/lib/d1/binding";

/**
 * The only way bytes enter the private R2 bucket: PUT /api/assets/upload with a link this site signed.
 *
 * On the deployed Worker this runs from worker.ts BEFORE OpenNext, because OpenNext reads every
 * request body into memory before a Next route sees it. Here the body is never held: it is piped
 * straight into R2 through a FixedLengthStream of the declared Content-Length, so the runtime itself
 * refuses a body longer or shorter than declared and R2 stores nothing when the stream errors.
 * Under `next start` (the e2e suite) the Next route calls this same function, and a counting stream
 * stands in for FixedLengthStream, which only the Workers runtime has.
 *
 * A link is single-use: the key it signs is written once. Uploads land under `_pending/` (an R2
 * lifecycle rule removes anything left there after a day) and the confirm step moves the object to
 * its final key, so an upload that is never confirmed costs nothing for long.
 */
export const PENDING_UPLOAD_PREFIX = "_pending/";

export function finalKeyFor(pendingKey: string) {
  return pendingKey.startsWith(PENDING_UPLOAD_PREFIX) ? pendingKey.slice(PENDING_UPLOAD_PREFIX.length) : undefined;
}

function answer(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** The body, sized: the runtime's FixedLengthStream on the Worker, a counting stream elsewhere. Either errors on a wrong length. */
export function sizedBody(body: ReadableStream<Uint8Array>, length: number): ReadableStream<Uint8Array> {
  const Fixed = (globalThis as { FixedLengthStream?: new (length: number) => TransformStream<Uint8Array, Uint8Array> }).FixedLengthStream;
  if (Fixed) return body.pipeThrough(new Fixed(length));
  let seen = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > length) { controller.error(new Error(`body is longer than the declared ${length} bytes`)); return; }
      controller.enqueue(chunk);
    },
    flush(controller) {
      if (seen !== length) controller.error(new Error(`body is ${seen} bytes, not the declared ${length}`));
    },
  }));
}

export async function handleAssetUpload(request: Request, deps: { bucket: R2BucketLike | undefined; secret?: string }): Promise<Response> {
  if (request.method !== "PUT" && request.method !== "POST") return answer(405, { ok: false, error: "Upload with PUT." });
  const check = await verifyUploadUrl(new URL(request.url).searchParams, { secret: deps.secret }).catch((error) => ({ ok: false as const, status: 403 as const, reason: error instanceof Error ? error.message : String(error) }));
  if (!check.ok) return answer(check.status, { ok: false, error: check.reason });
  const finalKey = finalKeyFor(check.key);
  if (!finalKey) return answer(403, { ok: false, error: "That upload link is not for a new upload." });
  const bucket = deps.bucket;
  if (!bucket) return answer(503, { ok: false, error: "File storage is not bound on this deployment (R2 binding ASSETS_BUCKET)." });
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (contentType !== check.mimeType) return answer(415, { ok: false, error: `This link is for ${check.mimeType}, not ${contentType || "an unnamed type"}.` });
  const declaredHeader = request.headers.get("content-length");
  const declared = declaredHeader === null || declaredHeader.trim() === "" ? NaN : Number(declaredHeader);
  if (!Number.isSafeInteger(declared) || declared < 0) return answer(411, { ok: false, error: "The upload did not say how large the file is, so nothing was saved. Try the upload again from the page." });
  if (declared > Math.min(check.sizeBytes, EVENT_ASSET_MAX_BYTES)) return answer(413, { ok: false, error: "The file is larger than the upload link allows, so nothing was saved." });
  if (declared === 0 || !request.body) return answer(400, { ok: false, error: "That file is empty, so nothing was saved." });
  if ((await bucket.head(check.key)) || (await bucket.head(finalKey))) return answer(409, { ok: false, error: "This upload link was already used. Start the upload again from the page." });
  try {
    await bucket.put(check.key, sizedBody(request.body, declared), { httpMetadata: { contentType: check.mimeType } });
  } catch (error) {
    // Nothing is recorded: the library row is written only by the confirm step, from an object it finds.
    console.error(`[assets/upload] R2 put failed for ${check.key}:`, error instanceof Error ? error.message : error);
    return answer(502, { ok: false, error: "Storage did not accept the file, so nothing was saved. Try the upload again." });
  }
  return answer(200, { ok: true, key: check.key, sizeBytes: declared });
}
