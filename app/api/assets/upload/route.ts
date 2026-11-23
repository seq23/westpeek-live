import { getAssetsBucket } from "@/lib/d1/binding";
import { handleAssetUpload } from "@/services/assets/assetUploadHandler";

export const dynamic = "force-dynamic";

/**
 * On the deployed Worker, worker.ts answers /api/assets/upload before OpenNext, so this route is
 * never reached there; it serves the same handler under `next start` and `next dev`.
 */
async function handle(request: Request) {
  return handleAssetUpload(request, { bucket: getAssetsBucket() });
}

export const PUT = handle;
export const POST = handle;
