"use client";

import { useActionState } from "react";
import { addAssetLinkAction, type AssetLinkResult } from "@/lib/actions/eventAssetActions";

/**
 * "Or paste a link". The server is the check (https only); when it refuses, its sentence shows
 * under the field and what was typed stays there to fix, instead of the page turning into an error.
 */
export function AssetLinkForm({ eventId }: { eventId: string }) {
  const [result, formAction, pending] = useActionState<AssetLinkResult, FormData>(addAssetLinkAction, undefined);
  const refused = result && !result.ok ? result : undefined;
  return (
    <form action={formAction} className="rounded-2xl border border-brand-line p-4 text-sm" data-testid="asset-link-form">
      <p className="font-black text-brand-black">Or paste a link</p>
      <p className="mt-1 text-xs text-brand-muted">For a file that lives in Drive, Dropbox or a client portal — or if storage is unavailable.</p>
      <input type="hidden" name="eventId" value={eventId} />
      <input key={refused ? `refused-${refused.pasted}` : "url"} name="url" type="url" required pattern="https://.+" title="Paste the full address, starting with https://" placeholder="https://drive.google.com/…" defaultValue={refused?.pasted} aria-invalid={refused ? true : undefined} aria-describedby={refused ? "asset-link-error" : undefined} className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="asset-link-url" />
      <input name="fileName" placeholder="What is it? (optional)" className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="asset-link-name" />
      {refused ? <p id="asset-link-error" role="alert" className="mt-2 text-xs font-bold text-red-700" data-testid="asset-link-error">{refused.message}</p> : null}
      <button disabled={pending} className="mt-3 rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white disabled:opacity-60" data-testid="asset-link-submit">{pending ? "Adding…" : "Add the link"}</button>
    </form>
  );
}
