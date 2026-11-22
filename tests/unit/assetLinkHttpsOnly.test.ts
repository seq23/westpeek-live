import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Or paste a link": only an absolute https address is saved, and the download route only ever
 * redirects to one. A lying form (http, javascript:, data:, a path on this site, user:password@)
 * saves nothing; a row saved before the rule is not opened.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const who = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/auth/workspaceActor", () => ({ getWorkspaceActor: async () => (who.signedIn ? { kind: "owner", id: "owner", label: "Owner", role: "owner" } : undefined) }));
vi.mock("@/lib/auth/liveControlRequestGuard", () => ({ requireLiveEventControlAccessForRequest: async () => ({ ok: false, error: "Only the event's crew can add files." }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { addAssetLinkAction } from "@/lib/actions/eventAssetActions";
import { assetDownloadUrl, listEventAssets, recordUploadedAsset } from "@/services/assets/eventAssetService";
import { ASSET_LINK_REFUSAL, httpsAssetLink } from "@/types/eventAssets";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const refused = [
  "http://drive.example.test/deck.pdf",
  "javascript:alert(document.cookie)",
  "JavaScript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "/api/assets/file?key=x",
  "//evil.example.test/x",
  "https://user:secret@drive.example.test/deck.pdf",
  "drive.example.test/deck.pdf",
  "https://",
];

describe("pasted links are https only", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-asset-link-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  });
  afterEach(() => { who.signedIn = true; setRuntimeStoreForTests(undefined); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("an https link is saved as typed (trimmed)", async () => {
    expect(await addAssetLinkAction(undefined, form({ eventId: "event-a", url: "  https://drive.example.test/file/d/abc/view  ", fileName: "Deck" }))).toEqual({ ok: true });
    const [asset] = await listEventAssets("event-a");
    expect(asset.externalUrl).toBe("https://drive.example.test/file/d/abc/view");
    expect(await assetDownloadUrl(asset.id)).toEqual({ ok: true, url: "https://drive.example.test/file/d/abc/view" });
  });

  it.each(refused)("refuses %s and saves nothing", async (url) => {
    expect(httpsAssetLink(url)).toBeUndefined();
    // The refusal is returned for the form to show (a throw would put the error screen up instead).
    expect(await addAssetLinkAction(undefined, form({ eventId: "event-a", url }))).toEqual({ ok: false, message: ASSET_LINK_REFUSAL, pasted: url.trim() });
    expect(await listEventAssets("event-a")).toHaveLength(0);
  });

  it("a row saved before the rule with a non-https link is not opened", async () => {
    const asset = await recordUploadedAsset({ eventId: "event-a", assetId: "asset-link-old", externalUrl: "javascript:alert(1)", fileName: "old", mimeType: "text/uri-list", sizeBytes: 0, uploadedByKind: "operator", uploadedByLabel: "operator" });
    expect(await assetDownloadUrl(asset.id)).toMatchObject({ ok: false, reason: expect.stringMatching(/not an https address/) });
  });

  it("someone without access gets the refusal as a message, and nothing is saved", async () => {
    who.signedIn = false;
    expect(await addAssetLinkAction(undefined, form({ eventId: "event-a", url: "https://drive.example.test/deck.pdf" }))).toEqual({ ok: false, message: "Only the event's crew can add files.", pasted: "https://drive.example.test/deck.pdf" });
    expect(await listEventAssets("event-a")).toHaveLength(0);
  });
});
