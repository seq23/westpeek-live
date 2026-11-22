import type { EmailWorkflowPayload } from "@/types/emailWorkflows";
import { buildProductionEmailRequest } from "./productionEmailService";

export function buildClientInvite(input: Omit<EmailWorkflowPayload, "workflowType" | "subject"> & { subject?: string }) {
  return buildProductionEmailRequest({
    ...input,
    workflowType: "client_invite",
    subject: input.subject ?? "You are invited to your event portal",
  });
}

export function buildTestingFailureAlert(input: Omit<EmailWorkflowPayload, "workflowType" | "subject"> & { subject?: string }) {
  return buildProductionEmailRequest({
    ...input,
    workflowType: "testing_failure_alert",
    subject: input.subject ?? "Testing issue requires attention",
  });
}

export function buildReportReadyEmail(input: Omit<EmailWorkflowPayload, "workflowType" | "subject"> & { subject?: string }) {
  return buildProductionEmailRequest({
    ...input,
    workflowType: "report_ready",
    subject: input.subject ?? "Your event report is ready",
  });
}
