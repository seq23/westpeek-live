import { EmailAcrossEvents } from "@/components/email/EmailAcrossEvents";
import { GroupEmailOverview } from "@/components/email/GroupEmailOverview";
import { EmailStatusPanel } from "@/components/email/EmailStatusPanel";
import { TestEmailPanel } from "@/components/email/TestEmailPanel";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/** The cross-event record of what has actually been sent. Sending happens per event. */
export default function EmailPage() {
  return (
    <main className="space-y-6">
      <SafeSection label="Email across events" render={() => EmailAcrossEvents()} />
      <SafeSection label="Group email" render={() => GroupEmailOverview()} />
      <EmailStatusPanel />
      <TestEmailPanel />
    </main>
  );
}
