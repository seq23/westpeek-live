import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rule the owner locked (plan §2.5, §2.6): an owner holding the master key never enters a code.
 *
 * The bug this proves gone, reported by the owner on 16 Sep 2026 as "every time I click open it
 * gives me another operator launchpad gate": the speaker, sponsor and client layouts bounced their
 * visitor to the special-guest code gate whenever a GUEST cookie they also held had gone stale —
 * without ever asking whether that visitor was the owner. An owner who had once entered a speaker
 * code to check the green room, and then rotated the codes, was sent to a code gate every time she
 * opened a speaker page, holding the master key the whole while.
 */

const redirect = vi.fn((target: string) => {
  throw new Error(`REDIRECT:${target}`);
});
let stale = true;
let viewerKind = "owner";

vi.mock("next/navigation", () => ({ redirect: (target: string) => redirect(target) }));
vi.mock("@/lib/events/canonicalEventRoute", () => ({ canonicalEventIdOrRedirect: async (id: string) => id }));
vi.mock("@/services/events/accessCodeService", () => ({ guestAccessStale: async () => stale }));
// The chrome the layouts render is not what is under test, and pulling the real bar in would drag
// React's server `cache()` into a plain node test.
vi.mock("@/components/command/EventChromeStack", () => ({ EventChromeStack: () => null }));
vi.mock("@/components/command/EventCommandBar", () => ({ EventCommandBar: () => null }));
vi.mock("@/components/system/SafeSection", () => ({ SafeSection: () => null }));
vi.mock("@/lib/auth/crewViewer", () => ({
  getCrewViewer: async () => ({ kind: viewerKind, label: viewerKind, description: "", allowed: "all", isHost: true }),
}));

import SpeakerEventLayout from "@/app/speaker/events/[eventId]/layout";
import SponsorEventLayout from "@/app/sponsor/events/[eventId]/layout";
import ClientEventLayout from "@/app/client/[clientSlug]/events/[eventId]/layout";
import { holdsMasterKey } from "@/lib/auth/ownerNeverEntersACode";

vi.mock("@/services/events/runtimeEventOverlay", () => ({ ensureRuntimeEvent: async (id: string) => ({ id }) }));

async function render(layout: (input: never) => Promise<unknown>, params: Record<string, string>) {
  return layout({ children: null, params: Promise.resolve(params) } as never);
}

describe("an owner holding the master key never enters a code", () => {
  beforeEach(() => {
    redirect.mockClear();
    stale = true;
    viewerKind = "owner";
  });

  it("knows who holds the master key, and asks the same question the command bar asks", async () => {
    for (const kind of ["owner", "operator"]) {
      viewerKind = kind;
      expect(await holdsMasterKey("event-summit")).toBe(true);
    }
    for (const kind of ["crew", "none"]) {
      viewerKind = kind;
      expect(await holdsMasterKey("event-summit")).toBe(false);
    }
  });

  const surfaces: [string, (input: never) => Promise<unknown>, Record<string, string>][] = [
    ["speaker", SpeakerEventLayout as never, { eventId: "event-summit" }],
    ["sponsor", SponsorEventLayout as never, { eventId: "event-summit" }],
    ["client", ClientEventLayout as never, { clientSlug: "west-peek", eventId: "event-summit" }],
  ];

  for (const [name, layout, params] of surfaces) {
    it(`does not send the owner from the ${name} surface to a code gate when a stale guest cookie is also present`, async () => {
      viewerKind = "owner";
      await render(layout, params);
      expect(redirect).not.toHaveBeenCalled();
    });

    it(`still sends a real ${name} guest with a stale code back for the new link`, async () => {
      viewerKind = "none";
      await expect(render(layout, params)).rejects.toThrow("REDIRECT:/production-access/special-guest?error=rotated");
      expect(redirect).toHaveBeenCalledWith("/production-access/special-guest?error=rotated");
    });
  }
});
