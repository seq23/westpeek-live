"use client";
import { useState, useTransition } from "react";
import { archiveTestPeopleAction } from "@/lib/actions/peopleActions";

/** Owner-only. Confirms with the number and the events, then archives — nothing is ever hard-deleted. */
export function ArchiveTestRowsButton({ testCount, eventNames }: { testCount: number; eventNames: string[] }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | undefined>();
  if (!testCount) return null;
  const summary = `Archive ${testCount} test ${testCount === 1 ? "row" : "rows"} from ${eventNames.length} ${eventNames.length === 1 ? "event" : "events"}: ${eventNames.slice(0, 6).join(", ")}${eventNames.length > 6 ? "…" : ""}. They are archived, never deleted, and no row from a real event is touched.`;
  return (
    <span className="ml-3 inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        data-testid="archive-test-rows"
        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-800 disabled:opacity-40"
        onClick={() => {
          if (!window.confirm(summary)) return;
          startTransition(async () => {
            const result = await archiveTestPeopleAction();
            setDone(`Archived ${result.archivedContacts} contacts and ${result.archivedProfiles} attendee rows.`);
          });
        }}
      >
        {pending ? "Archiving…" : `Archive test rows (${testCount})`}
      </button>
      {done ? <span className="text-xs font-bold text-emerald-800" data-testid="archive-test-rows-done">{done}</span> : null}
    </span>
  );
}
