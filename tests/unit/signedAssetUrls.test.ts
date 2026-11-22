import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAssetsBucketForTests, type R2BucketLike } from "@/lib/d1/binding";
import { signDownloadUrl, signUploadUrl, verifyDownloadUrl, verifyUploadUrl } from "@/services/assets/signedUrlService";
import { promoteUpload, requestAssetUpload } from "@/services/assets/eventAssetService";
import { slugify } from "@/services/events/eventRepository";
import lifecycle from "../../r2-lifecycle.json";
import { handleAssetUpload, PENDING_UPLOAD_PREFIX } from "@/services/assets/assetUploadHandler";
import { uploadRefusalMessage } from "@/types/eventAssets";

/**
 * The private R2 bucket opens only to links this Worker signed. Expired, tampered, widened and
 * unsigned links are refused, by the verifier and by the two routes that move bytes.
 */
const SECRET = "test-secret-for-signed-asset-links-0123456789";
const NOW = Date.parse("2026-10-06T12:00:00.000Z");

function memoryBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const bucket: R2BucketLike = {
    async put(key, value, options) {
      // A stream is read to its end, as R2 does; a stream that errors stores nothing.
      if (value instanceof ReadableStream) value = new Uint8Array(await new Response(value).arrayBuffer());
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
      return {};
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return { body: new Response(object.bytes).body!, size: object.bytes.byteLength, httpMetadata: { contentType: object.contentType }, arrayBuffer: async () => object.bytes.buffer as ArrayBuffer };
    },
    async head(key) {
      const object = objects.get(key);
      return object ? { size: object.bytes.byteLength } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return { bucket, objects };
}

function paramsOf(url: string) {
  return new URL(url, "https://westpeek.live").searchParams;
}

let previousSecret: string | undefined;
beforeEach(() => {
  previousSecret = process.env.V5_ACCESS_COOKIE_SECRET;
  process.env.V5_ACCESS_COOKIE_SECRET = SECRET;
});
afterEach(() => {
  process.env.V5_ACCESS_COOKIE_SECRET = previousSecret;
  setAssetsBucketForTests(undefined);
});

describe("signed upload and download links", () => {
  it("accepts a fresh link and refuses an expired one", async () => {
    const upload = await signUploadUrl({ key: "evt/as-1/deck.pdf", mimeType: "application/pdf", sizeBytes: 10, now: NOW, secret: SECRET });
    expect(upload.startsWith("/api/assets/upload?")).toBe(true);
    expect(await verifyUploadUrl(paramsOf(upload), { now: NOW + 60_000, secret: SECRET })).toMatchObject({ ok: true, key: "evt/as-1/deck.pdf", sizeBytes: 10 });
    expect(await verifyUploadUrl(paramsOf(upload), { now: NOW + 11 * 60_000, secret: SECRET })).toMatchObject({ ok: false, status: 410 });

    const download = await signDownloadUrl({ key: "evt/as-1/deck.pdf", now: NOW, secret: SECRET });
    expect(await verifyDownloadUrl(paramsOf(download), { now: NOW + 60_000, secret: SECRET })).toMatchObject({ ok: true });
    expect(await verifyDownloadUrl(paramsOf(download), { now: NOW + 11 * 60_000, secret: SECRET })).toMatchObject({ ok: false, status: 410 });
  });

  it("refuses a link whose key, size, type, expiry or signature was changed, or that another secret signed", async () => {
    const upload = paramsOf(await signUploadUrl({ key: "evt/as-1/deck.pdf", mimeType: "application/pdf", sizeBytes: 10, now: NOW, secret: SECRET }));
    for (const [name, value] of [["key", "evt/as-1/other.pdf"], ["size", "999999"], ["mime", "text/html"], ["exp", String(Math.floor(NOW / 1000) + 99_999)], ["sig", "AAAA"]] as const) {
      const tampered = new URLSearchParams(upload);
      tampered.set(name, value);
      expect(await verifyUploadUrl(tampered, { now: NOW, secret: SECRET })).toMatchObject({ ok: false, status: 403 });
    }
    expect(await verifyUploadUrl(upload, { now: NOW, secret: "a-different-secret-entirely-0000000000" })).toMatchObject({ ok: false, status: 403 });
    const download = paramsOf(await signDownloadUrl({ key: "evt/as-1/deck.pdf", now: NOW, secret: SECRET }));
    download.set("key", "house/logo/x/logo.png");
    expect(await verifyDownloadUrl(download, { now: NOW, secret: SECRET })).toMatchObject({ ok: false, status: 403 });
    expect(await verifyDownloadUrl(new URLSearchParams("key=a"), { now: NOW, secret: SECRET })).toMatchObject({ ok: false, status: 400 });
  });
});

/**
 * A request as the Worker receives it, with a Content-Length the client chose (fetch's Request will
 * not let a test set one) and a body that counts how much of it was ever read.
 */
function rawUpload(link: string, chunks: Uint8Array[], options: { contentLength?: number; type?: string } = {}) {
  const pulled = { chunks: 0 };
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) { controller.close(); return; }
      pulled.chunks += 1;
      controller.enqueue(chunks[index++]);
    },
  }, { highWaterMark: 0 }); // pulled only when someone reads, so the count is what was read
  const headers = new Headers({ "content-type": options.type ?? "application/pdf" });
  if (options.contentLength !== undefined) headers.set("content-length", String(options.contentLength));
  return { request: { method: "PUT", url: `https://westpeek.live${link}`, headers, body } as unknown as Request, pulled };
}

const PDF = new TextEncoder().encode("%PDF-1.4 test");

describe("the upload handler (worker.ts, before OpenNext) pipes bytes into R2 only on a valid link", () => {
  it("an event named \"Pending\" keeps its finished files: the lifecycle rule deletes only uploads in progress, under a prefix no event id can start", async () => {
    const { bucket, objects } = memoryBucket();
    setAssetsBucketForTests(bucket);
    const eventId = slugify("Pending");
    expect(eventId).toBe("pending");
    // Event ids are slugs ([a-z0-9-]); the upload prefix starts with a character a slug never has.
    for (const name of ["Pending", "_pending", "  _Pending/ ", "pending uploads"]) expect(slugify(name).startsWith(PENDING_UPLOAD_PREFIX.slice(0, -1)), name).toBe(false);

    const ticket = await requestAssetUpload({ eventId, fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: PDF.byteLength });
    if (!ticket.ok) throw new Error(ticket.reason);
    const pendingKey = ticket.storagePath;
    expect(pendingKey.startsWith(`${PENDING_UPLOAD_PREFIX}pending/`)).toBe(true);
    const link = new URL(ticket.signedUrl, "https://westpeek.live");
    expect((await handleAssetUpload(rawUpload(`${link.pathname}${link.search}`, [PDF], { contentLength: PDF.byteLength }).request, { bucket })).status).toBe(200);
    const stored = await promoteUpload(pendingKey);
    if (!stored.ok) throw new Error("promote failed");
    expect(stored.storagePath.startsWith("pending/")).toBe(true);
    expect(objects.has(stored.storagePath)).toBe(true);

    // What the R2 lifecycle rule (set from r2-lifecycle.json on every deploy) would delete after a day.
    const deletes = (key: string) => lifecycle.rules.some((rule) => rule.enabled && "deleteObjectsTransition" in rule && key.startsWith(rule.conditions.prefix));
    expect(deletes(pendingKey)).toBe(true);
    expect(deletes(stored.storagePath)).toBe(false);
    for (const key of Array.from(objects.keys())) expect(deletes(key), key).toBe(false);
  });

  it("round-trips a file through _pending/ to its final key, and refuses tampering, the wrong type and a link used twice", async () => {
    const { bucket, objects } = memoryBucket();
    setAssetsBucketForTests(bucket);
    const { GET } = await import("@/app/api/assets/file/route");
    const link = await signUploadUrl({ key: "_pending/evt/as-1/deck.pdf", mimeType: "application/pdf", sizeBytes: PDF.byteLength });

    expect((await handleAssetUpload(rawUpload(link, [PDF], { contentLength: PDF.byteLength, type: "text/html" }).request, { bucket })).status).toBe(415);
    expect((await handleAssetUpload(rawUpload(link.replace("as-1", "as-2"), [PDF], { contentLength: PDF.byteLength }).request, { bucket })).status).toBe(403);
    const unpending = await signUploadUrl({ key: "evt/as-1/deck.pdf", mimeType: "application/pdf", sizeBytes: PDF.byteLength });
    expect((await handleAssetUpload(rawUpload(unpending, [PDF], { contentLength: PDF.byteLength }).request, { bucket })).status).toBe(403);
    expect(objects.size).toBe(0);

    const ok = await handleAssetUpload(rawUpload(link, [PDF], { contentLength: PDF.byteLength }).request, { bucket });
    expect(ok.status).toBe(200);
    expect(objects.get("_pending/evt/as-1/deck.pdf")?.contentType).toBe("application/pdf");
    const replay = await handleAssetUpload(rawUpload(link, [new TextEncoder().encode("%PDF-1.4 evil")], { contentLength: PDF.byteLength }).request, { bucket });
    expect(replay.status).toBe(409);

    const stored = await promoteUpload("_pending/evt/as-1/deck.pdf");
    expect(stored).toEqual({ ok: true, storagePath: "evt/as-1/deck.pdf", sizeBytes: PDF.byteLength });
    expect(objects.has("_pending/evt/as-1/deck.pdf")).toBe(false);
    // After confirm, the same link still cannot write: the final key exists.
    expect((await handleAssetUpload(rawUpload(link, [PDF], { contentLength: PDF.byteLength }).request, { bucket })).status).toBe(409);
    expect(await promoteUpload("_pending/evt/as-1/deck.pdf")).toMatchObject({ ok: false });

    const download = await signDownloadUrl({ key: "evt/as-1/deck.pdf" });
    const file = await GET(new Request(`https://westpeek.live${download}`));
    expect(file.status).toBe(200);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PDF);
  });

  it("no Content-Length: 411, and none of the body is read", async () => {
    const { bucket, objects } = memoryBucket();
    const link = await signUploadUrl({ key: "_pending/evt/as-5/deck.pdf", mimeType: "application/pdf", sizeBytes: 1_000 });
    const { request, pulled } = rawUpload(link, [PDF]);
    const response = await handleAssetUpload(request, { bucket });
    expect(response.status).toBe(411);
    expect(await response.json()).toMatchObject({ ok: false, error: expect.stringMatching(/nothing was saved/) });
    expect(pulled.chunks).toBe(0);
    expect(objects.size).toBe(0);
  });

  it("a declared length over the link: 413 before any of the body is read", async () => {
    const { bucket, objects } = memoryBucket();
    const link = await signUploadUrl({ key: "_pending/evt/as-2/deck.pdf", mimeType: "application/pdf", sizeBytes: 1_000 });
    const { request, pulled } = rawUpload(link, [new Uint8Array(1_001)], { contentLength: 1_001 });
    expect((await handleAssetUpload(request, { bucket })).status).toBe(413);
    expect(pulled.chunks).toBe(0);
    expect(objects.size).toBe(0);
  });

  it("a client that lies about its length (says 10, sends 30,000) stores nothing, and reading stops at the lie", async () => {
    const { bucket, objects } = memoryBucket();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const link = await signUploadUrl({ key: "_pending/evt/as-3/deck.pdf", mimeType: "application/pdf", sizeBytes: 1_000 });
    const { request, pulled } = rawUpload(link, Array.from({ length: 50 }, () => new Uint8Array(600)), { contentLength: 10 });
    const response = await handleAssetUpload(request, { bucket });
    expect(response.status).toBe(502);
    expect(pulled.chunks).toBeLessThanOrEqual(2);
    expect(objects.size).toBe(0);
    consoleError.mockRestore();
  });

  it("a body shorter than declared stores nothing", async () => {
    const { bucket, objects } = memoryBucket();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const link = await signUploadUrl({ key: "_pending/evt/as-6/deck.pdf", mimeType: "application/pdf", sizeBytes: 1_000 });
    expect((await handleAssetUpload(rawUpload(link, [PDF], { contentLength: 500 }).request, { bucket })).status).toBe(502);
    expect(objects.size).toBe(0);
    consoleError.mockRestore();
  });

  it("a put that fails answers in words, and the uploader shows those words", async () => {
    const { bucket } = memoryBucket();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = { ...bucket, put: async () => { throw new Error("R2 internal error"); } };
    setAssetsBucketForTests(broken);
    const link = await signUploadUrl({ key: "_pending/evt/as-4/deck.pdf", mimeType: "application/pdf", sizeBytes: PDF.byteLength });
    const response = await handleAssetUpload(rawUpload(link, [PDF], { contentLength: PDF.byteLength }).request, { bucket: broken });
    expect(response.status).toBe(502);
    expect(consoleError).toHaveBeenCalled();
    expect(await uploadRefusalMessage(response, "The file did not reach storage")).toBe("Storage did not accept the file, so nothing was saved. Try the upload again.");
    expect(await uploadRefusalMessage(new Response("<html>gateway</html>", { status: 504 }), "The file did not reach storage")).toBe("The file did not reach storage (storage answered 504).");
    // The confirm step finds nothing, so no library row is written.
    expect(await promoteUpload("_pending/evt/as-4/deck.pdf")).toMatchObject({ ok: false });
    consoleError.mockRestore();
  });

  it("answers 503 in words when the bucket is not bound (the Next route under next start)", async () => {
    const { PUT } = await import("@/app/api/assets/upload/route");
    const link = await signUploadUrl({ key: "_pending/evt/as-9/a.pdf", mimeType: "application/pdf", sizeBytes: 3 });
    const response = await PUT(rawUpload(link, [new Uint8Array(3)], { contentLength: 3 }).request);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, error: expect.stringMatching(/ASSETS_BUCKET/) });
  });
});
