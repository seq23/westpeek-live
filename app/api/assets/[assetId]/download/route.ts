import { NextResponse } from "next/server";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { assetDownloadUrl } from "@/services/assets/eventAssetService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";

export const dynamic = "force-dynamic";

/**
 * A file leaves the private bucket only through a signed URL that expires in ten minutes, and only
 * for someone who may see this event: the owner, an operator, or crew with a cookie for it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await getRuntimeStore().getEventAsset(assetId).catch(() => undefined);
  if (!asset) return NextResponse.json({ ok: false, error: "No such file." }, { status: 404 });
  const actor = await getWorkspaceActor();
  if (!actor) {
    const viewer = await getCrewViewer(asset.eventId);
    if (viewer.kind === "none") return NextResponse.json({ ok: false, error: "Crew, operator or owner access required." }, { status: 403 });
  }
  const link = await assetDownloadUrl(assetId);
  if (!link.ok) return NextResponse.json({ ok: false, error: link.reason }, { status: 503 });
  return NextResponse.redirect(link.url, { status: 307, headers: { "cache-control": "no-store" } });
}
