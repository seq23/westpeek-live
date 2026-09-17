/**
 * The PRIMARY OWNER ACTIONS, named by the plan the owner locked on 16 Sep 2026:
 *
 *   docs/plans/OWNER_ONE_PLACE_AND_VIEW_AS.md §2.6 — "an owner holding the master key never needs
 *   to enter a code, and never needs a second page to finish one intention. ... fails if a primary
 *   action (go live, end show, stage requests, codes, enter the room) is reachable from only one of
 *   them."
 *
 * This file is that parenthetical, as data. `scripts/validate_owner_one_place_rule.js` reads the
 * plan, reads this, and refuses to run if the two lists have drifted apart — so the rule cannot be
 * quietly narrowed by editing either one alone. Nothing here is a second list to keep: the ids ARE
 * the plan's words.
 *
 * `modules` are the files that MEAN "you can do this from here". Reachability is measured by
 * following imports from a surface's own routes, never by looking for an identifier: two different
 * components both exported as `EnterTheRoomMenu` is exactly how the personas ended up reachable
 * from the event workspace and nowhere else.
 */
export interface OwnerPrimaryAction {
  /** The plan's own word for it. */
  id: string;
  /** What the control says. */
  label: string;
  /** Any one of these modules, reached from a surface, means the action is reachable from it. */
  modules: readonly string[];
}

export const OWNER_PRIMARY_ACTIONS: readonly OwnerPrimaryAction[] = [
  {
    id: "go live",
    label: "Go live",
    // The server action itself, so the publish page and the bar card both count, and a third way
    // of going live counts the day it exists.
    modules: ["lib/actions/goLiveActions.ts"],
  },
  {
    id: "end show",
    label: "End show",
    modules: ["components/moderation/EndShowControl.tsx"],
  },
  {
    id: "stage requests",
    label: "Stage requests",
    modules: ["components/moderation/StageRequestsToggle.tsx"],
  },
  {
    id: "codes",
    label: "Codes",
    // Two real renderings of the same six codes: the bar's masked menu and the event's access page.
    modules: ["components/command/CommandBarCodes.tsx", "components/events/EventAccessCodesPanel.tsx"],
  },
  {
    id: "enter the room",
    label: "Enter the room",
    modules: ["components/preview/EnterTheRoomMenu.tsx"],
  },
] as const;
