import type { V4CrewRole } from "@/types/v4";

/**
 * THE crew permission map. One table, used by the server guards
 * (`requireLiveEventControlAccessForRequest`, `requireCrewCapability`), the deck (which renders a
 * control disabled with the reason when the role may not use it), the crew gate (which describes
 * each role before the choice is made), and the role badge on every crew page.
 *
 * Owner and operator cookies are not in this table: they may do everything.
 */
export type CrewAction =
  | "view_event"
  | "view_run_of_show"
  | "go_live"
  | "moderate_chat"
  | "manage_stage_access"
  | "manage_cue_cards"
  | "advance_run_of_show"
  | "delay_segment"
  | "log_incident"
  | "view_support"
  | "edit_draft_setup"
  | "mark_ready_for_review"
  | "publish_event"
  | "deploy_event"
  | "archive_event"
  | "view_audit"
  | "moderate_session"
  | "switch_video_fallback"
  | "clear_video_fallback"
  | "run_video_health_check";

export const CREW_ROLES: readonly V4CrewRole[] = ["crew", "executive_producer", "producer", "technical_director", "show_caller", "moderator", "va", "support"];

const VIEW: readonly CrewAction[] = ["view_event", "view_run_of_show"];

export const crewActionPermissions: Record<V4CrewRole, readonly CrewAction[]> = {
  crew: [...VIEW],
  executive_producer: [...VIEW, "go_live", "moderate_chat", "manage_stage_access", "manage_cue_cards", "advance_run_of_show", "delay_segment", "log_incident", "view_support", "edit_draft_setup", "mark_ready_for_review", "publish_event", "deploy_event", "archive_event", "view_audit", "moderate_session", "switch_video_fallback", "clear_video_fallback", "run_video_health_check"],
  producer: [...VIEW, "go_live", "moderate_chat", "manage_stage_access", "manage_cue_cards", "advance_run_of_show", "log_incident", "publish_event", "view_audit"],
  technical_director: [...VIEW, "go_live", "switch_video_fallback", "clear_video_fallback", "run_video_health_check"],
  show_caller: [...VIEW, "moderate_chat", "manage_stage_access", "manage_cue_cards", "advance_run_of_show", "delay_segment", "log_incident"],
  moderator: [...VIEW, "moderate_chat", "manage_stage_access", "moderate_session", "log_incident"],
  va: [...VIEW, "edit_draft_setup", "mark_ready_for_review"],
  support: [...VIEW, "view_support", "log_incident"],
};

export const crewRoleLabels: Record<V4CrewRole, string> = {
  crew: "Crew",
  executive_producer: "Executive Producer (host)",
  producer: "Producer",
  technical_director: "Technical Director",
  show_caller: "Show Caller",
  moderator: "Moderator",
  va: "VA / Production Assistant",
  support: "Support",
};

/** One line each, shown under the role on the crew gate and in the badge on every crew page. */
export const crewRoleDescriptions: Record<V4CrewRole, string> = {
  crew: "Sees everything on the crew pages and presses nothing. For an observer or a runner.",
  executive_producer: "The host. Every control for this one event: go live, end the show, the stage, chat, cue cards, publishing.",
  producer: "Runs the show with the host: go live, end the show, the stage roster, chat, cue cards, publishing.",
  technical_director: "Owns the feed: generate the RTMP credentials, move the fallback ladder, end the show. Not chat, not the stage roster.",
  show_caller: "Calls the cues: advance the run of show, cue cards, the stage roster, chat. Cannot move the stream.",
  moderator: "Keeps the room civil: hide, silence, and lock chat; permit and revoke attendees; bring speakers up. Cannot move the stream.",
  va: "Sets up drafts before the show. No live controls.",
  support: "Helps people in: sees everything, logs incidents, works the help queue. No live controls.",
};

/** What the deck says a denied control does, in the reason sentence. */
const actionPhrases: Partial<Record<CrewAction, string>> = {
  go_live: "move the stream or end the show",
  moderate_chat: "moderate chat",
  manage_stage_access: "change who is on the stage",
  manage_cue_cards: "edit cue cards or producer notes",
  advance_run_of_show: "advance the run of show",
  delay_segment: "delay a segment",
  log_incident: "log an incident",
  publish_event: "publish the event",
  switch_video_fallback: "switch the video fallback",
  clear_video_fallback: "clear the video fallback",
  run_video_health_check: "run the video health check",
  edit_draft_setup: "edit the setup draft",
};

function shortLabel(role: V4CrewRole) {
  return role === "executive_producer" ? "the Executive Producer" : role === "technical_director" ? "the Technical Director" : role === "show_caller" ? "the Show Caller" : role === "va" ? "a VA" : `a ${crewRoleLabels[role].toLowerCase()}`;
}

export function rolesAllowed(action: CrewAction): V4CrewRole[] {
  return CREW_ROLES.filter((role) => crewActionPermissions[role].includes(action));
}

export function roleAllows(role: V4CrewRole | undefined, action: CrewAction) {
  return crewActionPermissions[(role || "crew") as V4CrewRole]?.includes(action) ?? false;
}

/**
 * "Moderator can't move the stream or end the show — that's the Technical Director, the Executive
 * Producer, or a producer." The same sentence on the disabled control and in the server refusal.
 */
export function crewDeniedReason(role: V4CrewRole | undefined, action: CrewAction) {
  const actor = crewRoleLabels[(role || "crew") as V4CrewRole] || "Crew";
  const others = rolesAllowed(action).map(shortLabel);
  const who = others.length === 0 ? "the owner or the operator" : others.length === 1 ? others[0] : `${others.slice(0, -1).join(", ")}, or ${others[others.length - 1]}`;
  return `${actor} can't ${actionPhrases[action] || action.replaceAll("_", " ")} — that's ${who}.`;
}
