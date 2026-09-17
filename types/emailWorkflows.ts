export type EmailWorkflowType =
  | "client_invite"
  | "speaker_invite"
  | "sponsor_setup_invite"
  | "contractor_assignment"
  | "approval_request"
  | "changes_requested"
  | "tech_check_reminder"
  | "asset_deadline_reminder"
  | "show_day_reminder"
  | "testing_failure_alert"
  | "report_ready"
  // The crew call sheet (16 Sep 2026). It was the one segment the old Communications panel had and
  // the new one did not, so it came across when that panel was deleted rather than being lost.
  | "crew_call_sheet"
  // The plan-an-event path (migration 0036): the approval the client is sent, and the five
  // instruction emails that go out when the event is paid for. Each instruction carries a link to
  // an editable /how-it-works page, never a copy of it.
  | "scope_approved"
  | "instructions_client"
  | "instructions_crew"
  | "instructions_speaker"
  | "instructions_sponsor"
  | "instructions_attendee";

export interface EmailWorkflowPayload {
  agencyId?: string;
  clientId?: string;
  eventId?: string;
  workflowType: EmailWorkflowType;
  to: string;
  subject: string;
  eventName?: string;
  recipientName?: string;
  actionUrl?: string;
  dueAt?: string;
  summary?: string;
}
