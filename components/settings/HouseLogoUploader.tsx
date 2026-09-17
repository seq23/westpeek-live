"use client";
import { useRef, useState, useTransition } from "react";
import { confirmHouseLogoUploadAction, requestHouseLogoUploadAction } from "@/lib/actions/houseDefaultsActions";

/**
 * The same two-step signed upload the asset library uses: the server mints a short-lived URL, the
 * browser PUTs the bytes straight to Supabase Storage, and only then is the path recorded. The
 * Worker never carries the file and the browser never sees a service key. Every refusal is said in
 * words — including "storage is not configured here", which is a real answer, not a failure.
 */
export function HouseLogoUploader() {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; message?: string }>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setState({ kind: "busy", message: `Uploading ${file.name}…` });
    const ticket = await requestHouseLogoUploadAction({ fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size });
    if (!ticket.ok) { setState({ kind: "error", message: ticket.reason }); return; }
    try {
      const response = await fetch(ticket.signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
      if (!response.ok) throw new Error(`storage answered ${response.status}`);
    } catch (error) {
      setState({ kind: "error", message: `The logo did not reach storage (${error instanceof Error ? error.message : String(error)}).` });
      return;
    }
    startTransition(async () => {
      await confirmHouseLogoUploadAction({ storagePath: ticket.storagePath, fileName: file.name });
      setState({ kind: "done", message: `${file.name} is the logo now. Reload to see it in the header.` });
    });
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-brand-line p-4 text-sm" data-testid="house-logo-uploader" data-state={state.kind}>
      <p className="font-black text-brand-black">Upload a logo</p>
      <p className="mt-1 text-xs text-brand-muted">PNG, JPG or SVG. A square image reads best — it renders at 48 to 96 pixels.</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="mt-3 block w-full text-xs"
        data-testid="house-logo-file-input"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}
      />
      {state.kind !== "idle" ? (
        <p className={`mt-3 rounded-xl p-3 text-xs font-bold ${state.kind === "error" ? "bg-red-50 text-red-800" : state.kind === "done" ? "bg-emerald-50 text-emerald-900" : "bg-brand-ash text-brand-black"}`} data-testid={`house-logo-${state.kind}`}>
          {state.message || "Working…"}{pending ? " Saving…" : ""}
        </p>
      ) : null}
    </div>
  );
}
