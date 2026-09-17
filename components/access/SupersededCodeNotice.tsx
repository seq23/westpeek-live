import { supersededAttendeeMessage } from "@/types/supersededCode";

/**
 * One line, on the page the person was actually invited to, when they arrived on an event code we
 * have since changed.
 *
 * They are NOT asked to type anything. They came with a valid invitation, the code moved because we
 * moved it, and the whole failure this fixes was making an attendee prove themselves again for our
 * decision. So this is an explanation, not a gate: it says the code changed, it confirms this is the
 * right event, and it gets out of the way. Rendered on the three places /join lands.
 */
export function SupersededCodeNotice({ oldCode }: { oldCode?: string }) {
  if (!oldCode) return null;
  return (
    <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900" data-testid="superseded-code-notice" data-old-code={oldCode}>
      {supersededAttendeeMessage(oldCode)}
    </p>
  );
}

/** The destination /join sends an out-of-date invitation to: the event, plus the line above. */
export function withSupersededCode(destination: string, oldCode: string | undefined) {
  if (!oldCode) return destination;
  return `${destination}${destination.includes("?") ? "&" : "?"}codeChanged=${encodeURIComponent(oldCode)}`;
}
