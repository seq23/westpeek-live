import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAssetsBucketForTests, type R2BucketLike } from "@/lib/d1/binding";
import { signDownloadUrl, signUploadUrl, verifyDownloadUrl, verifyUploadUrl } from "@/services/assets/signedUrlService";
import { assetUploadRefusal } from "@/types/eventAssets";

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

  it("SVG is taken again and served sandboxed inline: an SVG carrying <script> opens with the sandbox CSP and nosniff; HTML and Office files download", async () => {
    for (const place of ["portal", "library", "logo"] as const) expect(assetUploadRefusal({ mimeType: "image/svg+xml", sizeBytes: 100, fileName: "logo.svg", place }), place).toBeUndefined();
    const { bucket } = memoryBucket();
    setAssetsBucketForTests(bucket);
    const { GET } = await import("@/app/api/assets/file/route");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/api/owner")</script></svg>';
    await bucket.put("house/logo/logo-1/logo.svg", new TextEncoder().encode(svg), { httpMetadata: { contentType: "image/svg+xml" } });
    await bucket.put("evt/as-2/page.html", new TextEncoder().encode("<script>alert(1)</script>"), { httpMetadata: { contentType: "text/html" } });
    await bucket.put("evt/as-3/slide.png", new Uint8Array([137, 80, 78, 71]), { httpMetadata: { contentType: "image/png" } });
    await bucket.put("evt/as-4/deck.pdf", new TextEncoder().encode("%PDF-1.4"), { httpMetadata: { contentType: "application/pdf" } });
    const office = { "evt/as-6/talk.pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "evt/as-7/brief.docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "evt/as-8/budget.xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    for (const [key, contentType] of Object.entries(office)) await bucket.put(key, new Uint8Array([80, 75, 3, 4]), { httpMetadata: { contentType } });

    const logo = await GET(new Request(`https://westpeek.live${await signDownloadUrl({ key: "house/logo/logo-1/logo.svg" })}`));
    expect(logo.status).toBe(200);
    expect(logo.headers.get("content-type")).toBe("image/svg+xml");
    expect(logo.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(logo.headers.get("content-security-policy")).toMatch(/^sandbox; default-src 'none'(;|$)/);
    expect(logo.headers.get("content-security-policy")).not.toMatch(/script-src|allow-scripts/);
    expect(logo.headers.get("x-content-type-options")).toBe("nosniff");
    for (const key of ["evt/as-2/page.html", ...Object.keys(office)]) {
      const response = await GET(new Request(`https://westpeek.live${await signDownloadUrl({ key })}`));
      expect(response.status, key).toBe(200);
      expect(response.headers.get("content-disposition"), key).toMatch(/^attachment;/);
      expect(response.headers.get("content-security-policy"), key).toMatch(/^sandbox; default-src 'none'/);
      expect(response.headers.get("x-content-type-options"), key).toBe("nosniff");
    }
    const png = await GET(new Request(`https://westpeek.live${await signDownloadUrl({ key: "evt/as-3/slide.png" })}`));
    expect(png.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(png.headers.get("content-security-policy")).toMatch(/^sandbox; default-src 'none'/);
    const pdf = await GET(new Request(`https://westpeek.live${await signDownloadUrl({ key: "evt/as-4/deck.pdf" })}`));
    expect(pdf.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(pdf.headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
    // A video opens in the browser's player, which a sandboxed document never starts; its sources stay locked.
    await bucket.put("evt/as-5/reel.mp4", new Uint8Array([0, 0, 0, 24]), { httpMetadata: { contentType: "video/mp4" } });
    const mp4 = await GET(new Request(`https://westpeek.live${await signDownloadUrl({ key: "evt/as-5/reel.mp4" })}`));
    expect(mp4.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(mp4.headers.get("content-security-policy")).toBe("default-src 'none'; media-src 'self'; frame-ancestors 'self'");
    expect(mp4.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("a refused file is told, in words, what to do next, and only the library offers a link", () => {
    for (const place of ["portal", "logo", undefined] as const) {
      for (const input of [{ mimeType: "text/html", sizeBytes: 100 }, { mimeType: "application/zip", sizeBytes: 100 }, { mimeType: "application/pdf", sizeBytes: 999_000_000 }]) {
        const message = assetUploadRefusal({ ...input, place })!;
        expect(message, `${place} ${input.mimeType}`).not.toMatch(/link|\//i);
        expect(message).toMatch(/upload that\.$/);
      }
    }
    expect(assetUploadRefusal({ mimeType: "application/zip", sizeBytes: 100, place: "library" })).toMatch(/paste a link/);
    expect(assetUploadRefusal({ mimeType: "application/pdf", sizeBytes: 100, place: "logo" })).toMatch(/can't be a logo/);
  });

  it("answers 503 in words when the bucket is not bound", async () => {
    const { PUT } = await import("@/app/api/assets/upload/route");
    const link = await signUploadUrl({ key: "evt/as-9/a.pdf", mimeType: "application/pdf", sizeBytes: 3 });
    const response = await PUT(new Request(`https://westpeek.live${link}`, { method: "PUT", body: "abc", headers: { "content-type": "application/pdf" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, error: expect.stringMatching(/ASSETS_BUCKET/) });
  });
});
