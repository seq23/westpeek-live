import { sendTestEmailSubmitAction } from "@/lib/actions/emailActions";
import { requiredEmailWorkflows } from "@/services/email";

/**
 * A deliverability check, and nothing else.
 *
 * This used to be the only action on the Email page, which made the page look like a feature that
 * had not been finished. It is a small secondary control now: it mails one address to prove the
 * provider works and the message renders. It is not attached to an event and it writes no log row,
 * so it is not a way to email anybody for real — that is the sender above.
 */
export function TestEmailPanel() {
  return (
    <details className="rounded-3xl border border-brand-line bg-white p-4 sm:p-5" data-testid="test-email-panel">
      <summary className="cursor-pointer text-sm font-black">Check deliverability with a test send</summary>
      <p className="mt-2 text-xs text-brand-muted">
        Mails one address to prove Resend is reachable and the template renders. Not attached to an event, not recorded in the log, and not a way to send anything real.
      </p>
      <form className="mt-4 grid gap-3 md:grid-cols-2" action={sendTestEmailSubmitAction}>
        <label className="text-sm font-black">
          Recipient
          <input className="mt-1 min-h-11 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" name="to" type="email" required aria-label="Recipient email" data-testid="test-email-to" />
        </label>
        <label className="text-sm font-black">
          Workflow
          <select className="mt-1 min-h-11 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" name="workflowType" defaultValue="client_invite" aria-label="Workflow">
            {requiredEmailWorkflows.map((workflow) => (
              <option key={workflow} value={workflow}>{workflow.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-black md:col-span-2">
          Event name
          <input className="mt-1 min-h-11 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" name="eventName" defaultValue="West Peek Live!" aria-label="Event name" />
        </label>
        <button className="rounded-full border border-brand-black px-5 py-2 text-sm font-bold md:col-span-2 md:justify-self-start" type="submit" data-testid="test-email-submit">
          Send the test
        </button>
      </form>
    </details>
  );
}
