import { isResendConfigured } from "@/lib/env";
import type { EmailProvider } from "./EmailProvider";
import { createEmailProvider, withHouseAddresses } from "./emailService";
import { buildEmailSendLog } from "./emailLogService";
import { buildWorkflowPreview, renderEmailWorkflowHtml } from "./emailWorkflowTemplates";
import { renderEmailWorkflowText } from "./emailWorkflowService";
import type { EmailWorkflowPayload } from "@/types/emailWorkflows";
import type { ProductionEmailRequest } from "@/types/emailProduction";

export function buildProductionEmailRequest(payload: EmailWorkflowPayload & {
  agencyId?: string;
  clientId?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
}): ProductionEmailRequest {
  const preview = buildWorkflowPreview(payload);

  return {
    agencyId: payload.agencyId,
    clientId: payload.clientId,
    eventId: payload.eventId,
    workflowType: payload.workflowType,
    recipient: {
      email: payload.to,
      name: payload.recipientName,
    },
    subject: preview.subject,
    html: renderEmailWorkflowHtml(payload),
    text: renderEmailWorkflowText(payload),
    actionUrl: payload.actionUrl,
    metadata: payload.metadata,
  };
}

export async function sendProductionEmail(
  request: ProductionEmailRequest,
  provider: EmailProvider = createEmailProvider(),
) {
  try {
    const result = await provider.send(await withHouseAddresses({
      to: request.recipient.email,
      subject: request.subject,
      html: request.html,
      text: request.text,
      headers: request.headers,
    }));

    return {
      result,
      log: buildEmailSendLog({ request, result }),
    };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "Unknown email failure";
    return {
      result: {
        id: `failed-${Date.now()}`,
        provider: "resend" as const,
        status: "failed" as const,
        failureReason,
      },
      log: buildEmailSendLog({ request, failureReason }),
    };
  }
}

export function getEmailSendingMode() {
  return isResendConfigured() ? "live_resend" : "mock_fallback";
}
