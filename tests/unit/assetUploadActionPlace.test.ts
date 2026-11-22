import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Only the crew's library has a link form. A guest's browser could ask for the library's wording;
 * the server answers a guest with the portal's next step whatever the client sends.
 * Only the edges are stood in for: who is signed in, and page revalidation.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const actor = vi.fn(async (): Promise<unknown> => undefined);
vi.mock("@/lib/auth/workspaceActor", () => ({ getWorkspaceActor: () => actor() }));
const guestIdentity = vi.fn(async (_eventId: string, role: string): Promise<unknown> => (role === "sponsor" ? { name: "Booth 4" } : undefined));
vi.mock("@/services/guests/guestIdentityService", () => ({ getCurrentGuestIdentity: (eventId: string, role: string) => guestIdentity(eventId, role) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { requestAssetUploadAction } from "@/lib/actions/eventAssetActions";

const refused = { eventId: "event-a", fileName: "files.zip", mimeType: "application/zip", sizeBytes: 100 };

describe("the server, not the browser, decides which next step an upload refusal offers", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-place-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    actor.mockResolvedValue(undefined);
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a sponsor asking for the library's wording is still given the portal's step, with no link form offered", async () => {
    const asked = await requestAssetUploadAction({ ...refused, place: "library" });
    expect(asked.ok).toBe(false);
    if (asked.ok) return;
    const portal = await requestAssetUploadAction({ ...refused, place: "portal" });
    expect(portal.ok).toBe(false);
    if (portal.ok) return;
    expect(asked.reason).toBe(portal.reason);
    expect(asked.reason).toMatch(/^That kind of file can.t be uploaded\./);
    expect(asked.reason).not.toMatch(/link/i);
  });

  it("the crew in the library is offered the link form for the same file", async () => {
    actor.mockResolvedValue({ kind: "operator", email: "crew@example.test" });
    const library = await requestAssetUploadAction({ ...refused, place: "library" });
    expect(library.ok).toBe(false);
    if (!library.ok) expect(library.reason).toMatch(/paste a link/i);
  });
});
