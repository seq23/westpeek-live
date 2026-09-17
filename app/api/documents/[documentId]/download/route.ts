import { NextResponse } from "next/server";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { findWestPeekDocument, renderWestPeekDocument } from "@/services/documents/westPeekDocuments";

export const dynamic = "force-dynamic";

/**
 * Download one of the West Peek documents as Markdown, built now.
 *
 * The five instruction pages are edited in the runtime store, so the bytes are rendered from the
 * live content on this request — there is no cached copy anywhere to go stale. The manual runs the
 * access-code check first and refuses rather than hands out a file with a code in it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const actor = await getWorkspaceActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Sign in to the workspace to download this." }, { status: 403 });
  const document = findWestPeekDocument(documentId);
  if (!document) return NextResponse.json({ ok: false, error: "No such document." }, { status: 404 });
  const rendered = await renderWestPeekDocument(documentId);
  if (!rendered.ok) return NextResponse.json({ ok: false, error: rendered.reason }, { status: 409 });
  return new NextResponse(rendered.markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${document.fileName}"`,
      "cache-control": "no-store",
    },
  });
}
