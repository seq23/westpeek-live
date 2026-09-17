import type { EmailWorkflowPayload, EmailWorkflowType } from "@/types/emailWorkflows";
import { PRODUCT_NAME } from "@/lib/brand";

const labels: Record<EmailWorkflowType, string> = {
  client_invite: "Client invite",
  speaker_invite: "Speaker invite",
  sponsor_setup_invite: "Sponsor setup invite",
  contractor_assignment: "Contractor assignment",
  approval_request: "Approval request",
  changes_requested: "Changes requested",
  tech_check_reminder: "Tech check reminder",
  asset_deadline_reminder: "Asset deadline reminder",
  show_day_reminder: "Show day reminder",
  testing_failure_alert: "Testing failure alert",
  report_ready: "Report ready",
  scope_approved: "Scope and price",
  instructions_client: "Instructions for the client",
  instructions_crew: "Instructions for crew",
  instructions_speaker: "Instructions for speakers",
  instructions_sponsor: "Instructions for sponsors",
  instructions_attendee: "Instructions for attendees",
};

/**
 * A summary is somebody's typed words, so it is escaped before it reaches the message, and blank
 * lines become paragraphs. Before this, a body containing `<` injected markup into the email and a
 * written-out announcement arrived as one run-on block.
 */
export function renderSummaryHtml(summary: string) {
  const escaped = summary
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("\n        ") || "<p></p>";
}

export function buildEmailSubject(payload: EmailWorkflowPayload) {
  if (payload.subject.trim()) return payload.subject.trim();
  const event = payload.eventName ? `: ${payload.eventName}` : "";
  return `${labels[payload.workflowType]}${event}`;
}

export function renderEmailWorkflowHtml(payload: EmailWorkflowPayload) {
  const greeting = payload.recipientName ? `Hi ${payload.recipientName},` : "Hi,";
  const summary = payload.summary ?? `${labels[payload.workflowType]} for ${payload.eventName ?? "your event"}`;
  const due = payload.dueAt ? `<p><strong>Due:</strong> ${payload.dueAt}</p>` : "";
  const action = payload.actionUrl
    ? `<p><a href="${payload.actionUrl}" style="display:inline-block;background:#050505;color:#ffffff;padding:12px 16px;border-radius:999px;text-decoration:none;font-weight:700;">Open task</a></p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#050505;background:#ffffff;">
      <div style="border:1px solid #e7e3dc;border-radius:24px;padding:24px;max-width:640px;">
        <p style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#f05a1a;font-weight:800;margin:0 0 12px;">West Peek Live!</p>
        <p>${greeting}</p>
        ${renderSummaryHtml(summary)}
        ${due}
        ${action}
        <p style="color:#73706a;font-size:12px;margin-top:24px;">Sent by ${PRODUCT_NAME}. Replies go to the event production team.</p>
      </div>
    </div>
  `;
}

export function buildWorkflowPreview(payload: EmailWorkflowPayload) {
  return {
    subject: buildEmailSubject(payload),
    html: renderEmailWorkflowHtml(payload),
  };
}
