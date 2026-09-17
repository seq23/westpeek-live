import { isResendConfigured } from "@/lib/env";
import { getHouseDefaults } from "@/services/agencies/houseDefaultsService";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./EmailProvider";
import { MockEmailProvider } from "./MockEmailProvider";
import { ResendEmailProvider } from "./ResendEmailProvider";

export function createEmailProvider(): EmailProvider {
  if (isResendConfigured()) {
    return new ResendEmailProvider();
  }

  return new MockEmailProvider();
}

/**
 * The house from and reply-to, on every message that does not name its own.
 *
 * These used to come from the environment only, which meant changing the address the workspace
 * mails from was a redeploy. They are a setting now; the env value is still the floor, so an
 * install that never opens Settings behaves exactly as before. Both send paths go through here —
 * sendEmail, and sendProductionEmail's direct provider call — so there is nowhere a message can
 * leave from an address nobody chose.
 */
export async function withHouseAddresses(message: EmailMessage): Promise<EmailMessage> {
  const house = await getHouseDefaults().catch(() => undefined);
  if (!house) return message;
  return { ...message, from: message.from || house.fromEmail, replyTo: message.replyTo || house.replyToEmail };
}

export async function sendEmail(message: EmailMessage, provider: EmailProvider = createEmailProvider()): Promise<EmailSendResult> {
  return provider.send(await withHouseAddresses(message));
}

export async function sendApprovalRequestedEmail(input: {
  to: string;
  eventName: string;
  approvalTitle: string;
  approvalUrl: string;
}) {
  return sendEmail({
    to: input.to,
    subject: `Approval requested: ${input.approvalTitle}`,
    html: `
      <h1>Approval requested</h1>
      <p>You have a new approval request for <strong>${input.eventName}</strong>.</p>
      <p><a href="${input.approvalUrl}">Review approval</a></p>
    `,
    text: `Approval requested for ${input.eventName}: ${input.approvalUrl}`,
  });
}
