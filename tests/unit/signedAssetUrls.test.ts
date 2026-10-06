import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAssetsBucketForTests, type R2BucketLike } from "@/lib/d1/binding";
import { signDownloadUrl, signUploadUrl, verifyDownloadUrl, verifyUploadUrl } from "@/services/assets/signedUrlService";

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
      return objects.has(key) ? {} : null;
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

describe("the upload and file routes move bytes only on a valid link", () => {
  it("round-trips a file through R2 and refuses tampering, oversize and the wrong type", async () => {
    const { bucket, objects } = memoryBucket();
    setAssetsBucketForTests(bucket);
    const { PUT } = await import("@/app/api/assets/upload/route");
    const { GET } = await import("@/app/api/assets/file/route");
    const body = new TextEncoder().encode("%PDF-1.4 test");
    const link = await signUploadUrl({ key: "evt/as-1/deck.pdf", mimeType: "application/pdf", sizeBytes: body.byteLength });

    const wrongType = await PUT(new Request(`https://westpeek.live${link}`, { method: "PUT", body, headers: { "content-type": "text/html" } }));
    expect(wrongType.status).toBe(415);
    const tampered = await PUT(new Request(`https://westpeek.live${link.replace("evt%2Fas-1", "evt%2Fas-2")}`, { method: "PUT", body, headers: { "content-type": "application/pdf" } }));
    expect(tampered.status).toBe(403);
    const oversize = await PUT(new Request(`https://westpeek.live${link}`, { method: "PUT", body: new Uint8Array(body.byteLength + 1), headers: { "content-type": "application/pdf" } }));
    expect(oversize.status).toBe(413);
    expect(objects.size).toBe(0);

    const ok = await PUT(new Request(`https://westpeek.live${link}`, { method: "PUT", body, headers: { "content-type": "application/pdf" } }));
    expect(ok.status).toBe(200);
    expect(objects.get("evt/as-1/deck.pdf")?.contentType).toBe("application/pdf");

    const unsigned = await GET(new Request("https://westpeek.live/api/assets/file?key=evt%2Fas-1%2Fdeck.pdf"));
    expect(unsigned.status).toBe(400);
    const download = await signDownloadUrl({ key: "evt/as-1/deck.pdf" });
    const file = await GET(new Request(`https://westpeek.live${download}`));
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(body);
  });

  it("answers 503 in words when the bucket is not bound", async () => {
    const { PUT } = await import("@/app/api/assets/upload/route");
    const link = await signUploadUrl({ key: "evt/as-9/a.pdf", mimeType: "application/pdf", sizeBytes: 3 });
    const response = await PUT(new Request(`https://westpeek.live${link}`, { method: "PUT", body: "abc", headers: { "content-type": "application/pdf" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, error: expect.stringMatching(/ASSETS_BUCKET/) });
  });
});
