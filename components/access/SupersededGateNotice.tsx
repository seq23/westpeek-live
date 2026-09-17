import { supersededPrivilegedMessage } from "@/types/supersededCode";
import type { V4AccessResolution } from "@/types/v4";

/**
 * The privileged half of the superseded-code answer (17 Sep 2026). The gate has already refused —
 * nothing here grants anything — and this is only how the refusal reads.
 *
 * The generic "that access code is not valid for this event" is the right answer for a guess and
 * the wrong one for a crew member holding the code we rotated yesterday: identical sentences for
 * "never invited" and "your access ended", so their only move is to type it again. This names the
 * credential and the day it changed and points at the producer. It never names the current code —
 * the person at the gate has just proved they should not have it.
 */
export function SupersededGateNotice({ field, replacedAt, testId }: { field?: string; replacedAt?: string; testId: string }) {
  const known = ["crew", "speaker", "sponsor", "vip", "client"].includes(String(field));
  if (!known || !replacedAt) return null;
  return (
    <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800" data-testid={testId} data-superseded-field={field}>
      {supersededPrivilegedMessage(field as "crew" | "speaker" | "sponsor" | "vip" | "client", replacedAt)}
    </p>
  );
}

/** The query a refused privileged code redirects with: the gate, the credential, and the day. */
export function supersededGateQuery(access: Pick<V4AccessResolution, "reason" | "supersededField" | "supersededAt">) {
  if (access.reason !== "superseded_code" || !access.supersededField || !access.supersededAt) return undefined;
  return `error=superseded&codeField=${encodeURIComponent(access.supersededField)}&on=${encodeURIComponent(access.supersededAt)}`;
}
