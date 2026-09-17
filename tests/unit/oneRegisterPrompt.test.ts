import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The stage as an unregistered viewer had it on a 414px phone (the owner, 16 Sep 2026): three
 * separate asks to register inside one screen, two of them with nearly the same heading and the
 * same button. This renders the real page and counts. One register call to action, or it fails.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
// No attendee cookie of any kind: this is the person holding the link and nothing more.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { ensureRuntimeEvent, resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { buildVirtualVenueModel } from "@/services/venue";
import { MainStageExperience } from "@/components/venue/MainStageExperience";
import { VenueLobbyDashboard } from "@/components/venue/VenueLobbyDashboard";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

/**
 * React 18's server renderer cannot render an async server component, and the venue is made of
 * them. So the tree is resolved first: every component that can be called here is called, an async
 * one is awaited, and anything that reaches for a hook is left to the renderer with its children
 * already resolved. What comes out is the markup the page actually serves.
 */
async function resolveTree(node: unknown): Promise<unknown> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: unknown }>;
  if (typeof element.type === "function") {
    let out: unknown;
    try { out = (element.type as (props: unknown) => unknown)(element.props); } catch { out = undefined; }
    if (out && typeof (out as Promise<unknown>).then === "function") return resolveTree(await out);
    if (out !== undefined) return resolveTree(out);
  }
  if (element.props?.children !== undefined) return cloneElement(element, undefined, await resolveTree(element.props.children) as ReactElement);
  return element;
}

async function markup(node: Promise<unknown> | unknown) {
  return renderToStaticMarkup((await resolveTree(await node)) as ReactElement);
}

/** Every anchor that takes a person to the event's registration form, and nothing that merely
 *  passes the word on its way somewhere else. */
function registerCtas(html: string) {
  return html.match(/<a[^>]+href="[^"]*\/register(?:\?[^"]*)?"/g) || [];
}

describe("an unregistered viewer meets one register prompt, never a stack of them", () => {
  let eventId: string;

  beforeEach(async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-one-register-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    const event = await createEventRecord({ name: `One Ask Summit ${Date.now()}`, when: "now", timezone: "America/Chicago" }, owner);
    await ensureRuntimeEvent(event.id);
    eventId = event.id;
  });

  it("the main stage renders exactly one Register call to action", async () => {
    const html = await markup(MainStageExperience({ model: buildVirtualVenueModel(eventId) }));
    expect(registerCtas(html)).toHaveLength(1);
    // And that one is the shared card, in the chat column, with what registering unlocks on it.
    expect(html.match(/data-register-invitation="true"/g)).toHaveLength(1);
    expect(html).toContain("Watching costs you nothing");
    expect(html).toContain("Raise your hand to speak");
    expect(html).toContain("fifteen seconds");
  });

  it("the moment-of-intent asks are still there, folded away until the person presses one", async () => {
    const html = await markup(MainStageExperience({ model: buildVirtualVenueModel(eventId) }));
    // Pressing the composer or the raise-hand control is what opens each ask; neither is a second
    // card, and neither has been deleted.
    expect(html).toContain('data-register-point-of-use="chat"');
    expect(html).toContain('data-register-point-of-use="stage-request"');
    expect(html.match(/data-register-point-of-use-open="true"/g)).toBeNull();
  });

  it("the lobby renders exactly one Register call to action", async () => {
    const html = await markup(VenueLobbyDashboard({ model: buildVirtualVenueModel(eventId) }));
    expect(registerCtas(html)).toHaveLength(1);
    expect(html.match(/data-register-invitation="true"/g)).toHaveLength(1);
  });

  it("My plan does not ask a registered person's question of someone who is not registered", async () => {
    const html = await markup(MainStageExperience({ model: buildVirtualVenueModel(eventId) }));
    expect(html).not.toContain("My plan");
  });
});
