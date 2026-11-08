import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cloneElement, createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The demo venue as an attendee had it (walkthrough, 7 Nov 2026, before it was linked as proof of
 * the platform): an operator recording panel on the replay page, a developer note in the stage
 * player, a menu reading "Stage LIVE" over a player reading "Pre-stream", and replay cards marked
 * "Available" that opened nothing. This renders the real pages with no cookie of any kind.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams(), redirect: () => undefined, notFound: () => undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }), headers: async () => new Headers() }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { buildVirtualVenueModel } from "@/services/venue";
import { getVenueActivity, navMarkerFor } from "@/services/venue/venueActivityService";
import { getPublicStageStreamState } from "@/services/video/stageStreamStateService";
import { stageIsLive, stageShowsPreStream } from "@/lib/video/stageLiveState";
import { StagePlayer } from "@/components/video/StagePlayer";
import { ReplayCenter } from "@/components/venue/ReplayCenter";
import ReplayPage from "@/app/venue/[eventId]/replay/page";

const DEMO = "event-summit";

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

beforeEach(() => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-no-leaks-"));
  process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
  setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  resetOverlayForTests();
});

describe("attendee venue pages carry no production panels or developer notes", () => {
  it("the replay page, as an attendee, renders no recording-job panel", async () => {
    const html = await markup(ReplayPage({ params: Promise.resolve({ eventId: DEMO }) }));
    expect(html, "the replay page must still render its replays").toContain("Watch it again");
    expect(html).not.toMatch(/egress/i);
    expect(html).not.toContain("replay-assets/");
  });

  it("the stage player, as an attendee, carries no developer note", async () => {
    const state = await getPublicStageStreamState(DEMO, "main-stage");
    const html = renderToStaticMarkup(createElement(StagePlayer, { initialState: state, eventId: DEMO, viewerRole: "attendee" }));
    expect(html, "the player must render").toContain('data-testid="stage-player"');
    expect(html).not.toMatch(/provider changes|continuity is required|Attendee-facing/i);
  });
});

describe("the venue menu and the stage player read one stage state", () => {
  it("the demo, with no stream started, is pre-stream in the player and not LIVE in the menu", async () => {
    const model = buildVirtualVenueModel(DEMO);
    // The precondition that made them disagree: the agenda says a session is on right now.
    expect(model.liveNow.length).toBeGreaterThanOrEqual(1);
    const state = await getPublicStageStreamState(DEMO, "main-stage");
    const player = renderToStaticMarkup(createElement(StagePlayer, { initialState: state, eventId: DEMO, viewerRole: "attendee" }));
    const activity = await getVenueActivity(model);
    const menuSaysLive = navMarkerFor("stage", activity)?.label === "Live";
    const playerSaysPreStream = player.includes("Pre-stream");
    expect(playerSaysPreStream).toBe(true);
    expect(menuSaysLive).toBe(!playerSaysPreStream);
    expect(player).not.toContain("Live stage connected");
  });

  it("menu live equals player not-pre-stream across every stream status", () => {
    const statuses = ["GENERATING_CREDENTIALS", "READY_FOR_STREAMYARD", "STREAMYARD_CONNECTED", "LIVEKIT_INGRESS_LIVE", "CLOUDFLARE_STREAM_LIVE", "DAILY_LIVE", "ENDED"] as const;
    for (const streamStatus of statuses) {
      for (const hasEverStarted of [false, true]) {
        const state = { activeStreamSource: "LIVEKIT_INGRESS" as const, streamStatus, hasEverStarted };
        if (stageShowsPreStream(state)) expect(stageIsLive(state), `${streamStatus}/${hasEverStarted}`).toBe(false);
      }
    }
    expect(stageIsLive({ activeStreamSource: "LIVEKIT_INGRESS", streamStatus: "LIVEKIT_INGRESS_LIVE", hasEverStarted: true })).toBe(true);
  });
});

describe("a replay card says Available only when it opens a recording", () => {
  it("the demo's finished sessions are never labelled watchable without a recording", async () => {
    const model = buildVirtualVenueModel(DEMO);
    expect(model.replays.length, "the demo must list finished sessions").toBeGreaterThanOrEqual(1);
    const html = await markup(ReplayCenter({ eventId: DEMO, replays: model.replays }));
    expect(html).not.toMatch(/>\s*available\s*</i);
    expect(html).not.toContain("Watch replay");
    expect(html).toContain("Recording not posted yet");
  });

  it("a replay with a recording renders as a link to it", async () => {
    const html = await markup(ReplayCenter({ eventId: DEMO, replays: [{ id: "r1", title: "Keynote", status: "available", href: "#r1", playbackUrl: "https://example.test/keynote.mp4" }, { id: "r2", title: "Panel", status: "available", href: "#r2" }] }));
    expect(html).toMatch(/<a[^>]+href="https:\/\/example\.test\/keynote\.mp4"[^>]*>[\s\S]*Watch replay/);
    // "available" with nothing to play is not offered as watchable.
    expect(html.match(/Watch replay/g)).toHaveLength(1);
  });
});
