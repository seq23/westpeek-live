export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /**
   * Extra RFC headers. Group email needs List-Unsubscribe and List-Unsubscribe-Post so Gmail and
   * Apple Mail show their own unsubscribe control at the top of the message; a transactional send
   * passes none, which is how the two stay distinguishable at the wire.
   */
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  id: string;
  provider: "mock" | "resend";
  status: "queued" | "sent" | "skipped" | "failed";
  failureReason?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
