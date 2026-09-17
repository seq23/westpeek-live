import type { EmailMessage, EmailProvider, EmailSendResult } from "./EmailProvider";
import { getEmailReplyTo, getEnv, isResendConfigured } from "@/lib/env";

/**
 * Production Resend provider.
 *
 * Uses fetch directly to avoid adding a runtime SDK dependency. API keys are
 * read only from server-side environment variables.
 */
export class ResendEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const env = getEnv();

    if (!isResendConfigured(env)) {
      throw new Error("Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from || env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo || getEmailReplyTo(env),
        headers: message.headers,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend email failed: ${response.status} ${body}`);
    }

    const result = (await response.json()) as { id?: string };

    return {
      id: result.id || "resend-email-unknown",
      provider: "resend",
      status: "sent",
    };
  }
}
