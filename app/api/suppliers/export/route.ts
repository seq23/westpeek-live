import { NextResponse } from "next/server";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { suppliersCsvForFilter } from "@/services/suppliers/supplierRepository";
import { isSupplierKind, isSupplierStatus } from "@/types/suppliers";

export const dynamic = "force-dynamic";

/**
 * The CSV behind the Download button on /app/contractors and /app/vendors. It takes the SAME
 * `status` and `event` query the page is filtered by and runs the same repository call, so the file
 * is the rows on screen and nothing else. Workspace access only: rates and phone numbers.
 */
export async function GET(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Owner or operator access required." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const kindParam = params.get("kind") || "contractor";
  const kind = isSupplierKind(kindParam) ? kindParam : "contractor";
  const statusParam = params.get("status") || "";
  const eventId = params.get("event") || undefined;
  const csv = await suppliersCsvForFilter({ kind, status: isSupplierStatus(statusParam) ? statusParam : undefined, eventId });
  return new NextResponse(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="west-peek-${kind}s-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
