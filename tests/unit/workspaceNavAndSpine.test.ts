import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { activeNavHref, NEW_EVENT_ITEM, WORKSPACE_NAV } from "@/lib/navigation/workspaceNav";
import { OWNER_ACTOR_LABEL, ownerKeyLabel } from "@/lib/auth/workspaceActor";

/**
 * Three things the owner hit on 16 Sep 2026: the sidebar never marked where she was (the orange
 * "New event" button read as selected on every page), the event spine could not scroll so half its
 * groups were unreachable on a laptop, and the workspace chip claimed a person's name that shared
 * owner access cannot possibly know.
 */
describe("sidebar: exactly one current item, and it is the right one", () => {
  const cases: Array<[string, string]> = [
    ["/app", "/app"],
    ["/app/events", "/app/events"],
    ["/app/events/final-e2e-planned-event", "/app/events"],
    ["/app/events/final-e2e-planned-event/run-of-show", "/app/events"],
    ["/app/events/new", "/app/events/new"],
    ["/app/people", "/app/people"],
    ["/app/owner", "/app/owner"],
    ["/admin/testing/event-summit", "/admin/testing"],
  ];
  for (const [pathname, expected] of cases) {
    it(`${pathname} lights ${expected}`, () => {
      const active = activeNavHref(pathname);
      expect(active).toBe(expected);
      const all = [NEW_EVENT_ITEM, ...WORKSPACE_NAV].filter((item) => item.href === active);
      expect(all).toHaveLength(1);
    });
  }

  it("Dashboard is exact, so it does not light up inside the workspace", () => {
    expect(activeNavHref("/app/clients")).toBe("/app/clients");
    expect(activeNavHref("/app/events/x")).not.toBe("/app");
  });

  it("a path outside the nav lights nothing rather than guessing", () => {
    expect(activeNavHref("/venue/demo/lobby")).toBeUndefined();
  });

  it("the nav list is a client component that marks aria-current and does not reuse the CTA styling", () => {
    const list = fs.readFileSync("components/navigation/WorkspaceNavList.tsx", "utf8");
    expect(list).toContain('"use client"');
    expect(list).toContain("usePathname");
    expect(list).toContain('aria-current={current ? "page" : undefined}');
    // The active item is a slab with an orange rule; the CTA stays a solid orange button.
    expect(list).toContain("border-l-brand-orange");
    expect(fs.readFileSync("components/navigation/Sidebar.tsx", "utf8")).toContain("WorkspaceNavList");
  });
});

describe("the event spine scrolls inside its own column", () => {
  it("carries a max height AND a scroll class, so a restyle cannot silently remove either", () => {
    const spine = fs.readFileSync("components/events/EventWorkspaceSpine.tsx", "utf8");
    const column = spine.split("\n").find((line) => line.includes('data-testid="event-spine-column"')) || "";
    expect(column).toMatch(/lg:max-h-\[calc\(100vh-2rem\)\]/);
    const scroller = spine.split("\n").find((line) => line.includes('data-testid="event-spine-scroll"')) || "";
    expect(scroller).toContain("overflow-y-auto");
    expect(scroller).toContain("overscroll-contain");
    // "What's next" is pinned above the scrolling list.
    expect(spine).toMatch(/shrink-0[^\n]*NextStep/);
  });

  it("marks the page you are on and scrolls it into view", () => {
    const nav = fs.readFileSync("components/events/EventSpineNav.tsx", "utf8");
    expect(nav).toContain("usePathname");
    expect(nav).toContain('aria-current={active ? "page" : undefined}');
    expect(nav).toContain("scrollIntoView");
  });
});

describe("owner access never claims a person", () => {
  it("the label is just Owner, and the key is the only thing it may say", () => {
    expect(OWNER_ACTOR_LABEL).toBe("Owner");
    expect(ownerKeyLabel("primary")).toBe("key 1");
    expect(ownerKeyLabel("secondary")).toBe("key 2");
    expect(ownerKeyLabel(undefined)).toBeUndefined();
  });

  it("no service stamps a person's name as the owner actor", () => {
    const showEnd = fs.readFileSync("services/video/showEndService.ts", "utf8");
    expect(showEnd).not.toContain("Sequoia Taylor");
    expect(showEnd).toContain("OWNER_ACTOR_LABEL");
  });
});
