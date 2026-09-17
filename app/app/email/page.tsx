import { CrossEventSendPanel } from "@/components/email/CrossEventSendPanel";
import { EmailAcrossEvents } from "@/components/email/EmailAcrossEvents";
import { EmailStatusPanel } from "@/components/email/EmailStatusPanel";
import { TestEmailPanel } from "@/components/email/TestEmailPanel";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/**
 * Email: send one, and see everything that has been sent.
 *
 * This page used to hold a log and a test sender, and the test was the only button on it — the one
 * tab called Email was the one place you could not email anyone. The sender at the top is the same
 * action the event's Communications page posts to, so a send from here is a send from there.
 */
export default async function EmailPage({ searchParams }: { searchParams?: Promise<{ sent?: string; workflow?: string; emailError?: string }> }) {
  const query = searchParams ? await searchParams : undefined;
  return (
    <main className="space-y-6">
      <SafeSection label="Send an email" render={() => CrossEventSendPanel({ sent: query?.sent, workflowSent: query?.workflow, error: query?.emailError })} />
      <SafeSection label="Email across events" render={() => EmailAcrossEvents()} />
      <EmailStatusPanel />
      <TestEmailPanel />
    </main>
  );
}
