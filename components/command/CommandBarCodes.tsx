import Link from "next/link";
import { CopyButton } from "@/components/shared/CopyButton";
import { displayCode, type AccessCodeField } from "@/lib/access/accessCodes";
import { findEventRecord } from "@/services/events/eventRepository";
import { COMMAND_CHIP_MUTED } from "@/components/command/commandChrome";
import { COMMAND_PANEL } from "@/components/command/commandChrome";

const ROWS: Array<{ key: AccessCodeField; label: string }> = [
  { key: "join", label: "Attendee join" },
  { key: "crew", label: "Crew" },
  { key: "speaker", label: "Speaker" },
  { key: "sponsor", label: "Sponsor" },
  { key: "vip", label: "VIP" },
  { key: "client", label: "Client" },
];

/**
 * Masked so a code is not readable over someone's shoulder or in a screen share on show day —
 * which is exactly when this menu is open. Copy hands over the real one.
 */
function mask(code: string) {
  const shown = displayCode(code);
  if (shown.length <= 4) return shown;
  return `${shown.slice(0, 2)}${"•".repeat(Math.max(4, shown.length - 4))}${shown.slice(-2)}`;
}

/**
 * This event's six codes on the bar, so "what is the speaker code" stops being a trip to the
 * event's access-codes page. Setting and regenerating still lives there — this is read and copy.
 */
export async function CommandBarCodes({ eventId }: { eventId: string }) {
  const event = await findEventRecord(eventId);
  if (!event) return null;
  const codeFor = (key: AccessCodeField) => (key === "join" ? event.joinCode : event.accessCodes[key]);
  return (
    <details className="relative" data-testid="command-bar-codes">
      <summary className={`flex cursor-pointer list-none items-center gap-1 ${COMMAND_CHIP_MUTED}`}>
        Codes <span aria-hidden>▾</span>
      </summary>
      <div className={`${COMMAND_PANEL} p-3 xl:right-0 xl:w-80`}>
        <ul className="space-y-1">
          {ROWS.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-brand-ash" data-testid={`command-bar-code-${row.key}`}>
              <span className="text-xs font-black uppercase tracking-wide text-brand-muted">{row.label}</span>
              <span className="flex items-center gap-2">
                <code className="font-mono text-xs font-bold text-brand-black" data-masked="true">{mask(codeFor(row.key))}</code>
                <CopyButton value={displayCode(codeFor(row.key))} label="Copy" className="!px-2 !py-0.5 !text-[11px]" testId={`command-bar-copy-code-${row.key}`} />
              </span>
            </li>
          ))}
        </ul>
        <Link href={`/app/events/${eventId}/access`} className="mt-2 block rounded-xl bg-brand-ash px-3 py-2 text-xs font-black text-brand-black hover:bg-brand-line" data-testid="command-bar-all-codes">All codes, links and regeneration →</Link>
      </div>
    </details>
  );
}
