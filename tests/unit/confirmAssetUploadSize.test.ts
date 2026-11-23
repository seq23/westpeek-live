import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Step two of an upload records the file. The browser tells the server how big the file is; the
 * library must show what R2 really holds, so a client that lies about its size cannot write a
 * wrong size (or a zero) into the row. Only the edges are stood in for: who is signed in,
 * page revalidation and the bucket.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/auth/workspaceActor", () => ({ getWorkspaceActor: async () => ({ kind: "operator", label: "Crew lead", email: "crew@example.test" }) }));
vi.mock("@/services/guests/guestIdentityService", () => ({ getCurrentGuestIdentity: async () => undefined }));

import { setAssetsBucketForTests, type R2BucketLike } from "@/lib/d1/binding";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { confirmAssetUploadAction } from "@/lib/actions/eventAssetActions";
import { listEventAssets } from "@/services/assets/eventAssetService";

function memoryBucket() {
  const objects = new Map<string, Uint8Array>();
  const bucket: R2BucketLike = {
    async put(key, value) {
      if (value instanceof ReadableStream) value = new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer));
      return {};
    },
    async get(key) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      return { body: new Response(bytes).body!, size: bytes.byteLength, httpMetadata: { contentType: "application/pdf" }, arrayBuffer: async () => bytes.buffer as ArrayBuffer };
    },
    async head(key) {
      const bytes = objects.get(key);
      return bytes ? { size: bytes.byteLength } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return { bucket, objects };
}

describe("confirming an upload records the size R2 holds, never the size the browser claimed", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-confirm-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    setAssetsBucketForTests(undefined);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("a browser that says 1 byte (or 0) for a 4,096-byte file gets the real 4,096 in the library", async () => {
    const { bucket, objects } = memoryBucket();
    setAssetsBucketForTests(bucket);
    for (const [assetId, claimed] of [["as-1", 1], ["as-2", 0]] as const) {
      objects.set(`_pending/event-a/${assetId}/deck.pdf`, new Uint8Array(4096));
      const result = await confirmAssetUploadAction({ eventId: "event-a", assetId, storagePath: `_pending/event-a/${assetId}/deck.pdf`, fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: claimed });
      expect(result).toEqual({ ok: true, assetId });
    }
    const rows = await listEventAssets("event-a");
    expect(rows.map((row) => [row.id, row.sizeBytes, row.storagePath]).sort()).toEqual([
      ["as-1", 4096, "event-a/as-1/deck.pdf"],
      ["as-2", 4096, "event-a/as-2/deck.pdf"],
    ]);
  });

  it("an upload that never reached storage records nothing, whatever size the browser claims", async () => {
    const { bucket } = memoryBucket();
    setAssetsBucketForTests(bucket);
    const result = await confirmAssetUploadAction({ eventId: "event-a", assetId: "as-3", storagePath: "_pending/event-a/as-3/deck.pdf", fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: 4096 });
    expect(result.ok).toBe(false);
    expect(await listEventAssets("event-a")).toEqual([]);
  });
});
