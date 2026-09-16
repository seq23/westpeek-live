import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { GatedForm, DeniedNote } from "@/components/moderation/GatedForm";
import { AssetUploader } from "@/components/assets/AssetUploader";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { addAssetLinkAction, archiveAssetAction, reviewAssetAction, setAssetVisibilityAction } from "@/lib/actions/eventAssetActions";
import { listEventAssets } from "@/services/assets/eventAssetService";
import { assetSizeLabel, type EventAssetRecord } from "@/types/eventAssets";

/**
 * The event's real files: what was uploaded, by whom, how big, whether the crew has approved it and
 * whether the client sees it. Anything a speaker or sponsor sends arrives here as "in review".
 * Download is a signed link that expires; removal is archiving, never deletion.
 */
const STATUS_TONE: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  changes_requested: "bg-red-100 text-red-900",
};

function AssetRow({ eventId, asset, viewer }: { eventId: string; asset: EventAssetRecord; viewer: Awaited<ReturnType<typeof getCrewViewer>> }) {
  return (
    <li className="rounded-2xl border border-brand-line p-3" data-testid={`asset-row-${asset.id}`} data-status={asset.status} data-visibility={asset.visibility}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-brand-black">{asset.fileName}</p>
          <p className="text-xs text-brand-muted">
            {asset.externalUrl ? "link" : asset.mimeType || "file"} · {asset.externalUrl ? "no file stored" : assetSizeLabel(asset.sizeBytes)} · {asset.uploadedByLabel} ({asset.uploadedByKind}) · <LocalTime iso={asset.createdAt} mode="datetime" />
          </p>
          {asset.note ? <p className="mt-1 text-xs text-brand-muted">{asset.note}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wide">
          <span className={`rounded-full px-2 py-0.5 ${STATUS_TONE[asset.status]}`} data-testid={`asset-status-${asset.id}`}>{asset.status.replaceAll("_", " ")}</span>
          <span className="rounded-full bg-brand-ash px-2 py-0.5 text-brand-muted" data-testid={`asset-visibility-${asset.id}`}>{asset.visibility === "client_facing" ? "client sees it" : "internal"}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={`/api/assets/${asset.id}/download`} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black hover:border-brand-orange hover:text-brand-orange" data-testid={`asset-download-${asset.id}`}>Download</a>
        <GatedForm viewer={viewer} action="manage_assets" formAction={reviewAssetAction}>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="assetId" value={asset.id} /><input type="hidden" name="status" value={asset.status === "approved" ? "in_review" : "approved"} />
          <button className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-black text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40" data-testid={`asset-approve-${asset.id}`}>{asset.status === "approved" ? "Send back to review" : "Approve"}</button>
        </GatedForm>
        <GatedForm viewer={viewer} action="manage_assets" formAction={reviewAssetAction}>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="assetId" value={asset.id} /><input type="hidden" name="status" value="changes_requested" />
          <button className="rounded-full border border-brand-line px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" data-testid={`asset-changes-${asset.id}`}>Ask for changes</button>
        </GatedForm>
        <GatedForm viewer={viewer} action="manage_assets" formAction={setAssetVisibilityAction}>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="assetId" value={asset.id} /><input type="hidden" name="visibility" value={asset.visibility === "client_facing" ? "internal" : "client_facing"} />
          <button className="rounded-full border border-brand-line px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" data-testid={`asset-visibility-toggle-${asset.id}`}>{asset.visibility === "client_facing" ? "Make internal" : "Show the client"}</button>
        </GatedForm>
        <GatedForm viewer={viewer} action="manage_assets" formAction={archiveAssetAction}>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="assetId" value={asset.id} />
          <button className="rounded-full border border-brand-line px-3 py-1 text-xs font-black text-brand-muted disabled:cursor-not-allowed disabled:opacity-40" data-testid={`asset-archive-${asset.id}`}>Archive</button>
        </GatedForm>
      </div>
    </li>
  );
}

export async function EventAssetLibrary({ eventId, clientFacing = false }: { eventId: string; clientFacing?: boolean }) {
  const viewer = await getCrewViewer(eventId);
  const assets = await listEventAssets(eventId, { clientFacingOnly: clientFacing });
  const inReview = assets.filter((asset) => asset.status === "in_review").length;
  return (
    <SectionCard title={clientFacing ? "Files for the client" : "Assets"} eyebrow={`${assets.length} file${assets.length === 1 ? "" : "s"}${inReview ? ` · ${inReview} waiting for review` : ""}`}>
      <div data-testid="event-asset-library" data-count={assets.length} data-in-review={inReview}>
        <p className="text-sm text-brand-muted">Everything this event has been sent: decks, logos, graphics, contracts. A speaker or sponsor upload lands here as <strong>in review</strong> until the crew approves it. &ldquo;Show the client&rdquo; is what puts a file on their side of the wall. Archiving hides a file from the list; nothing is ever deleted.</p>
        {clientFacing ? null : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <AssetUploader eventId={eventId} />
            <form action={addAssetLinkAction} className="rounded-2xl border border-brand-line p-4 text-sm" data-testid="asset-link-form">
              <p className="font-black text-brand-black">Or paste a link</p>
              <p className="mt-1 text-xs text-brand-muted">For a file that lives in Drive, Dropbox or a client portal — or if storage is unavailable.</p>
              <input type="hidden" name="eventId" value={eventId} />
              <input name="url" placeholder="https://drive.google.com/…" className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="asset-link-url" />
              <input name="fileName" placeholder="What is it? (optional)" className="mt-2 w-full rounded-xl border border-brand-line px-3 py-2 text-sm" data-testid="asset-link-name" />
              <button className="mt-3 rounded-full bg-brand-black px-4 py-2 text-xs font-black text-white" data-testid="asset-link-submit">Add the link</button>
            </form>
          </div>
        )}
        <DeniedNote viewer={viewer} action="manage_assets" className="mt-4" />
        {assets.length ? (
          <ul className="mt-4 space-y-2">{assets.map((asset) => <AssetRow key={asset.id} eventId={eventId} asset={asset} viewer={viewer} />)}</ul>
        ) : (
          <div className="mt-4"><EmptyState title={clientFacing ? "Nothing approved for the client yet" : "No files yet"} body={clientFacing ? "Files appear here once production approves them and marks them client-facing." : "Drag a deck in, or paste a link. Speakers and sponsors can add their own from their portals."} /></div>
        )}
      </div>
    </SectionCard>
  );
}
