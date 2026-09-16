export type AuditAction =
  | "access_attempted"
  | "access_granted"
  | "access_denied"
  | "access_expired"
  | "access_revoked"
  | "event_publish_requested"
  | "event_publish_validated"
  | "event_publish_failed"
  | "video_fallback_switched"
  | "video_fallback_rollback"
  | "event_created"
  | "event_updated"
  | "event_status_changed"
  | "event_archived"
  | "event_restored"
  | "client_created"
  | "role_assigned"
  | "role_revoked"
  | "client_approval_requested"
  | "client_approved_item"
  | "client_requested_changes"
  | "run_of_show_segment_created"
  | "run_of_show_segment_edited"
  | "run_of_show_segment_deleted"
  | "speaker_readiness_changed"
  | "sponsor_booth_changed"
  | "contractor_assigned"
  | "vendor_assigned"
  | "asset_uploaded"
  | "asset_approved"
  | "production_note_added"
  | "incident_logged"
  | "report_exported"
  | "video_room_created"
  | "networking_report_submitted"
  | "approval_approve"
  | "approval_request_changes"
  | "approval_lock"
  | "approval_archive"
  | "inbox_matched"
  | "inbox_needs_review"
  | "inbox_converted_to_asset"
  | "inbox_converted_to_approval"
  | "inbox_ignored"
  | "inbox_archived"
  | "last_minute_change_approve"
  | "last_minute_change_approve_with_conditions"
  | "last_minute_change_reject"
  | "last_minute_change_push_to_live"
  | "last_minute_change_rollback"
  | "request_event_production"
  | "request_event_notification_failed"
  // Raised when public intake could not be stored. Before this existed there
  // was no action for a dropped request, because a dropped request was
  // indistinguishable from a stored one.
  | "request_event_persist_failed"
  // Crew chat moderation (hide / restore a message, silence / unsilence an attendee,
  // lock / unlock a room). Each is a reversible decision by owner, operator, or crew.
  | "chat_message_hidden"
  | "chat_message_restored"
  | "chat_attendee_silenced"
  | "chat_attendee_unsilenced"
  | "chat_room_locked"
  | "chat_room_unlocked"
  // Rate control: slow mode on / off for a room, and Clear chat (which archives, never deletes).
  | "chat_slow_mode_on"
  | "chat_slow_mode_off"
  | "chat_room_cleared"
  // Host links: the executive_producer crew role handed out (or revoked, rotating the crew code) for one event.
  | "host_link_minted"
  | "host_link_revoked"
  // An access code (join or a role code) set by hand or regenerated: a rotation.
  | "access_code_rotated"
  // The owner looked up a code in the console's vault, or copied it for a producer. The value is never in the row.
  | "access_code_revealed"
  | "access_code_copied"
  // The plan-an-event path (migration 0036). Money and instructions both hang off these four, so
  // every one of them is a person's decision with a row behind it.
  | "event_request_approved"
  | "event_request_declined"
  | "event_request_confirmed"
  | "event_request_paid"
  // An instruction page was edited from the workspace. Everyone holding the link reads the change.
  | "how_it_works_page_edited";
  // A producer looked at one named attendee: their reported state (Diagnose) or their view
  // (See their view). The row carries the attendee id and nothing else — never an IP, never a location.
  | "attendee_diagnosed"
  | "attendee_view_mirrored";

export interface CreateAuditLogInput {
  agencyId: string;
  clientId?: string;
  eventId?: string;
  actorUserId: string;
  actorRole: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  previousValue?: unknown;
  newValue?: unknown;
  visibility?: "internal_agency" | "client_visible_summary" | "system_only";
}
