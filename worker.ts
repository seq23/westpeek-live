// The Worker entry (wrangler.jsonc "main"). One path is answered before OpenNext: the signed upload,
// because OpenNext reads a request body into memory before any Next route runs, and an upload must be
// piped straight into R2 instead. Everything else goes to the OpenNext worker unchanged.
// @ts-ignore -- built by `opennextjs-cloudflare build` before wrangler bundles this file
import { default as openNextWorker } from "./.open-next/worker.js";
import { handleAssetUpload } from "./services/assets/assetUploadHandler";
import type { R2BucketLike } from "./lib/d1/binding";

type Env = { ASSETS_BUCKET?: R2BucketLike; V5_ACCESS_COOKIE_SECRET?: string } & Record<string, unknown>;

export default {
  async fetch(request: Request, env: Env, ctx: unknown) {
    if (new URL(request.url).pathname === "/api/assets/upload") {
      if (!env.V5_ACCESS_COOKIE_SECRET) return Response.json({ ok: false, error: "Uploads are not set up on this deployment (V5_ACCESS_COOKIE_SECRET)." }, { status: 503 });
      return handleAssetUpload(request, { bucket: env.ASSETS_BUCKET, secret: env.V5_ACCESS_COOKIE_SECRET });
    }
    return openNextWorker.fetch(request, env, ctx);
  },
};
