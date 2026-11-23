import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import type { R2BucketLike } from "@/lib/d1/binding";
import { signUploadUrl } from "@/services/assets/signedUrlService";
import { handleAssetUpload } from "@/services/assets/assetUploadHandler";
import { uploadRefusalMessage } from "@/types/eventAssets";

/**
 * An upload link is single-use, on a REAL R2 (workerd's, through Miniflare), not a fake: two uploads
 * fired at once on one link must end with exactly one stored file and the other refused. A
 * look-then-write let both pass the look and the second silently replace the first.
 * And a storage lookup that fails answers in a sentence (503), never a bare 500 or a write.
 */
const SECRET = "test-secret-for-signed-asset-links-0123456789";
let mf: Miniflare;
let bucket: R2BucketLike;
let previousSecret: string | undefined;

beforeAll(async () => {
  previousSecret = process.env.V5_ACCESS_COOKIE_SECRET;
  process.env.V5_ACCESS_COOKIE_SECRET = SECRET;
  mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", r2Buckets: ["ASSETS_BUCKET"] });
  const real = (await mf.getR2Bucket("ASSETS_BUCKET")) as unknown as R2BucketLike;
  // From Node, Miniflare can only take a body of known length (the Worker passes FixedLengthStream's
  // readable half). So the stream is read to bytes here; the write and its precondition are R2's own.
  bucket = {
    head: (key) => real.head(key),
    get: (key) => real.get(key),
    delete: (key) => real.delete(key),
    put: async (key, value, options) => real.put(key, value instanceof ReadableStream ? new Uint8Array(await new Response(value).arrayBuffer()) : value, options),
  };
});
afterAll(async () => {
  if (previousSecret === undefined) delete process.env.V5_ACCESS_COOKIE_SECRET;
  else process.env.V5_ACCESS_COOKIE_SECRET = previousSecret;
  await mf.dispose();
});

function upload(link: string, bytes: Uint8Array) {
  const headers = new Headers({ "content-type": "application/pdf", "content-length": String(bytes.byteLength) });
  return { method: "PUT", url: `https://westpeek.live${link}`, headers, body: new Response(bytes).body } as unknown as Request;
}

describe("an upload link writes once, even when two uploads race", () => {
  it("two uploads fired at once on one link: one is stored, the other is refused, and the stored file is the winner's whole file", async () => {
    const first = new TextEncoder().encode("%PDF-1.4 first upload");
    const second = new TextEncoder().encode("%PDF-1.4 other upload");
    const link = await signUploadUrl({ key: "_pending/evt/as-race/deck.pdf", mimeType: "application/pdf", sizeBytes: 1_000 });
    const [a, b] = await Promise.all([handleAssetUpload(upload(link, first), { bucket }), handleAssetUpload(upload(link, second), { bucket })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const refused = a.status === 409 ? a : b;
    expect(await uploadRefusalMessage(refused, "fallback")).toMatch(/already used/);
    const stored = await bucket.get("_pending/evt/as-race/deck.pdf");
    const winner = a.status === 200 ? first : second;
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(winner);
  });

  it("the same link used again after it finished is refused, and the first file is untouched", async () => {
    const original = new TextEncoder().encode("%PDF-1.4 original");
    const link = await signUploadUrl({ key: "_pending/evt/as-again/deck.pdf", mimeType: "application/pdf", sizeBytes: 1_000 });
    expect((await handleAssetUpload(upload(link, original), { bucket })).status).toBe(200);
    expect((await handleAssetUpload(upload(link, new TextEncoder().encode("%PDF-1.4 replaced")), { bucket })).status).toBe(409);
    expect(new Uint8Array(await (await bucket.get("_pending/evt/as-again/deck.pdf"))!.arrayBuffer())).toEqual(original);
  });

  it("a storage lookup that fails answers 503 in a sentence and writes nothing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const writes: string[] = [];
    const down: R2BucketLike = {
      head: async () => { throw new Error("R2 head: internal error"); },
      put: async (key) => { writes.push(key); return {}; },
      get: (key) => bucket.get(key),
      delete: (key) => bucket.delete(key),
    };
    const link = await signUploadUrl({ key: "_pending/evt/as-down/deck.pdf", mimeType: "application/pdf", sizeBytes: 1_000 });
    const response = await handleAssetUpload(upload(link, new TextEncoder().encode("%PDF-1.4 x")), { bucket: down });
    expect(response.status).toBe(503);
    expect(await uploadRefusalMessage(response, "fallback")).toBe("Storage could not be checked, so nothing was saved. Try the upload again in a minute.");
    expect(writes).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
