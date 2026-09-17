"use server";

import { redirect } from "next/navigation";
import { readUnsubscribeToken, recordResubscribe, recordUnsubscribe } from "@/services/email/emailSuppressionService";

/**
 * The two buttons on the public unsubscribe page. No login, because the person holding the token is
 * the person the token is for — that is the whole design of it — and demanding a sign-in from
 * somebody trying to stop email is how a domain earns spam complaints.
 *
 * The token is the only authority either action accepts, and it only ever acts on the address
 * inside it: there is no email field a caller could point somewhere else.
 */
function token(formData: FormData) {
  return String(formData.get("token") || "").trim();
}

export async function confirmUnsubscribeAction(formData: FormData): Promise<void> {
  const value = token(formData);
  const email = await readUnsubscribeToken(value);
  if (!email) redirect("/unsubscribe?state=invalid");
  await recordUnsubscribe({ email, source: "one_click" });
  redirect(`/unsubscribe?token=${encodeURIComponent(value)}&state=off`);
}

/** "I pressed that by mistake." One press, back on the list, no sign-in and no email to support. */
export async function undoUnsubscribeAction(formData: FormData): Promise<void> {
  const value = token(formData);
  const email = await readUnsubscribeToken(value);
  if (!email) redirect("/unsubscribe?state=invalid");
  await recordResubscribe({ email, by: "self" });
  redirect(`/unsubscribe?token=${encodeURIComponent(value)}&state=on`);
}
