import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { archiveAsset, listAssetsAcrossEvents, listEventAssets, recordUploadedAsset, requestAssetUpload, setAssetReview, setAssetVisibility } from "@/services/assets/eventAssetService";
import { assetUploadRefusal, EVENT_ASSET_MAX_BYTES } from "@/types/eventAssets";

/**
 * The asset library the owner can actually use: production's own upload is ready to work with, a
 * speaker's waits for review, visibility is what decides whether the client sees a file, and
 * "remove" is archiving — the row stays.
 */
describe("event assets", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-assets-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("refuses what it cannot take, in words", () => {
    expect(assetUploadRefusal({ mimeType: "application/pdf", sizeBytes: 1000 })).toBeUndefined();
    expect(assetUploadRefusal({ mimeType: "application/pdf", sizeBytes: EVENT_ASSET_MAX_BYTES + 1 })).toContain("the limit is");
    expect(assetUploadRefusal({ mimeType: "application/x-msdownload", sizeBytes: 10 })).toContain("We do not take");
    expect(assetUploadRefusal({ mimeType: "application/pdf", sizeBytes: 0 })).toContain("empty");
  });

  it("without Supabase storage the upload is refused with the reason and the link path is offered", async () => {
    const ticket = await requestAssetUpload({ eventId: "event-a", fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: 1000 });
    expect(ticket.ok).toBe(false);
    if (!ticket.ok) expect(ticket.reason).toMatch(/Paste a link|not configured/i);
  });

  it("a speaker's upload waits in review; production's own does not", async () => {
    const theirs = await recordUploadedAsset({ eventId: "event-a", assetId: "asset-1", storagePath: "event-a/asset-1/deck.pdf", fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: 2048, uploadedByKind: "speaker", uploadedByLabel: "Ada Lovelace" });
    expect(theirs.status).toBe("in_review");
    expect(theirs.visibility).toBe("internal");
    const ours = await recordUploadedAsset({ eventId: "event-a", assetId: "asset-2", storagePath: "event-a/asset-2/run.pdf", fileName: "run.pdf", mimeType: "application/pdf", sizeBytes: 1024, uploadedByKind: "operator", uploadedByLabel: "Sequoia" });
    expect(ours.status).toBe("uploaded");
    expect((await listEventAssets("event-a")).map((asset) => asset.id).sort()).toEqual(["asset-1", "asset-2"]);
  });

  it("approval plus client-facing is what puts a file on the client's side", async () => {
    await recordUploadedAsset({ eventId: "event-a", assetId: "asset-1", storagePath: "p", fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: 10, uploadedByKind: "speaker", uploadedByLabel: "Ada" });
    expect(await listEventAssets("event-a", { clientFacingOnly: true })).toHaveLength(0);
    await setAssetVisibility("asset-1", "client_facing");
    expect(await listEventAssets("event-a", { clientFacingOnly: true })).toHaveLength(0);
    await setAssetReview("asset-1", "approved", "crew:producer");
    const clientFacing = await listEventAssets("event-a", { clientFacingOnly: true });
    expect(clientFacing).toHaveLength(1);
    expect(clientFacing[0].reviewedBy).toBe("crew:producer");
  });

  it("archiving keeps the row and only hides it from the library", async () => {
    await recordUploadedAsset({ eventId: "event-a", assetId: "asset-1", storagePath: "p", fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: 10, uploadedByKind: "operator", uploadedByLabel: "Sequoia" });
    await archiveAsset("asset-1", "crew:producer");
    expect(await listEventAssets("event-a")).toHaveLength(0);
    expect(await listEventAssets("event-a", { includeArchived: true })).toHaveLength(1);
    expect((await getRuntimeStore().getEventAsset("asset-1"))?.archivedAt).toBeTruthy();
  });

  it("assets across events are grouped by the event they belong to", async () => {
    await recordUploadedAsset({ eventId: "event-a", assetId: "a1", storagePath: "p", fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10, uploadedByKind: "operator", uploadedByLabel: "S" });
    await recordUploadedAsset({ eventId: "event-b", assetId: "b1", storagePath: "p", fileName: "b.pdf", mimeType: "application/pdf", sizeBytes: 10, uploadedByKind: "operator", uploadedByLabel: "S" });
    const all = await listAssetsAcrossEvents();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((asset) => asset.eventId))).toEqual(new Set(["event-a", "event-b"]));
  });
});
