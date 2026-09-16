import { AssetUploader } from "@/components/assets/AssetUploader";
import { listEventAssets } from "@/services/assets/eventAssetService";
import { assetSizeLabel } from "@/types/eventAssets";

/**
 * A speaker's or sponsor's own files, sent from their portal. Theirs land as "in review" and the
 * producer decides; they see what they sent and where it got to, and nothing of anyone else's.
 */
export async function GuestAssetUpload({ eventId, role, name, readOnly = false }: { eventId: string; role: "speaker" | "sponsor"; name?: string; readOnly?: boolean }) {
  const mine = (await listEventAssets(eventId)).filter((asset) => asset.uploadedByKind === role && (!name || asset.uploadedByLabel === name));
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid={`${role}-asset-upload`} data-count={mine.length}>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Your files</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">Send the producer a deck, a logo, anything they need</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Nothing you send goes anywhere on its own: it waits as <strong>in review</strong> until the producer approves it. They will come back to you if they need a change.</p>
      {readOnly ? <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600" data-testid={`${role}-asset-upload-disabled`}>Uploading is theirs to do — you are previewing this page as them.</p> : <div className="mt-4"><AssetUploader eventId={eventId} who={role} /></div>}
      {mine.length ? (
        <ul className="mt-4 space-y-2 text-sm" data-testid={`${role}-asset-list`}>
          {mine.map((asset) => (
            <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 p-3" data-testid={`${role}-asset-${asset.id}`} data-status={asset.status}>
              <span className="truncate font-bold text-slate-950">{asset.fileName}</span>
              <span className="text-xs text-slate-500">{asset.externalUrl ? "link" : assetSizeLabel(asset.sizeBytes)} · {asset.status.replaceAll("_", " ")}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">You have not sent anything yet.</p>}
    </section>
  );
}
