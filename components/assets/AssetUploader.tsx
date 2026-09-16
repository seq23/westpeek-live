"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { confirmAssetUploadAction, requestAssetUploadAction } from "@/lib/actions/eventAssetActions";
import { assetSizeLabel, assetUploadRefusal, EVENT_ASSET_MAX_BYTES } from "@/types/eventAssets";

/**
 * Drag a file in or choose one. The bytes go straight from this browser to Supabase Storage through
 * a signed URL the server mints — the Worker never carries the file. Every refusal is said in
 * words, and when storage is not configured the page says so and offers the link instead.
 */
export function AssetUploader({ eventId, who = "production" }: { eventId: string; who?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; message?: string }>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    const refusal = assetUploadRefusal({ mimeType: file.type, sizeBytes: file.size });
    if (refusal) { setState({ kind: "error", message: refusal }); return; }
    setState({ kind: "busy", message: `Uploading ${file.name} (${assetSizeLabel(file.size)})…` });
    const ticket = await requestAssetUploadAction({ eventId, fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size });
    if (!ticket.ok) { setState({ kind: "error", message: ticket.reason || "The upload was refused and storage gave no reason. Paste a link instead." }); return; }
    try {
      const response = await fetch(ticket.signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
      if (!response.ok) throw new Error(`storage answered ${response.status}`);
    } catch (error) {
      setState({ kind: "error", message: `The file did not reach storage (${error instanceof Error ? error.message : String(error)}). Try again, or paste a link.` });
      return;
    }
    startTransition(async () => {
      await confirmAssetUploadAction({ eventId, assetId: ticket.assetId, storagePath: ticket.storagePath, fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size });
      setState({ kind: "done", message: `${file.name} is in the library.` });
    });
  }

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-5 text-sm ${dragging ? "border-brand-orange bg-brand-ash" : "border-brand-line"}`}
      data-testid="asset-uploader"
      data-state={state.kind}
      data-hydrated={hydrated ? "true" : "false"}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void upload(file); }}
    >
      <p className="font-black text-brand-black">Add a file</p>
      <p className="mt-1 text-xs text-brand-muted">Drag it here, or choose one. Decks, documents, images, MP4 and plain text up to {assetSizeLabel(EVENT_ASSET_MAX_BYTES)}. Uploaded as {who}.</p>
      <input
        ref={input}
        type="file"
        className="mt-3 block w-full text-xs"
        data-testid="asset-file-input"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}
      />
      {state.kind !== "idle" ? (
        <p className={`mt-3 rounded-xl p-3 text-xs font-bold ${state.kind === "error" ? "bg-red-50 text-red-800" : state.kind === "done" ? "bg-emerald-50 text-emerald-900" : "bg-brand-ash text-brand-black"}`} data-testid={`asset-upload-${state.kind}`}>
          {state.message || "Working…"}{pending ? " Saving the row…" : ""}
        </p>
      ) : null}
    </div>
  );
}
