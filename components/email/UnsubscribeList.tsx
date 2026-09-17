import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LocalTime } from "@/components/shared/LocalTime";
import { getCrewViewer, viewerDenied } from "@/lib/auth/crewViewer";
import { setUnsubscribeAction } from "@/lib/actions/groupEmailActions";
import { listUnsubscribes } from "@/services/email/emailSuppressionService";
import { unsubscribeIsActive } from "@/types/emailAudience";

/**
 * Who has asked West Peek to stop, and the crew's way to correct it.
 *
 * This is the whole business's list, not one event's — that is the point of it, and the reason the
 * panel lives beside the composer rather than on an event page. An unsubscribe is never deleted:
 * putting somebody back on writes a later timestamp over the top, so "she asked to stop in March and
 * asked to start again in June" stays readable.
 */
export async function UnsubscribeList() {
  const [viewer, rows] = await Promise.all([getCrewViewer(), listUnsubscribes()]);
  const denied = viewerDenied(viewer, "manage_access_codes");
  const off = rows.filter(unsubscribeIsActive);

  return (
    <SectionCard title="Unsubscribed" eyebrow={`${off.length} ${off.length === 1 ? "person is" : "people are"} out of every group send`}>
      <div data-testid="unsubscribe-list" data-active={off.length}>
        <p className="text-sm text-slate-600">
          These addresses are left out of every group send for every event. Messages addressed to one of them personally — a green room link, a booth setup, a report — still go, because those are not announcements.
        </p>
        {denied ? <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900" role="note">{denied}</p> : null}
        {rows.length ? (
          <ul className="mt-4 grid gap-2">
            {rows.map((row) => {
              const active = unsubscribeIsActive(row);
              return (
                <li key={row.email} className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-line p-3 text-sm" data-testid={`unsubscribe-row-${row.email}`} data-active={active ? "true" : "false"}>
                  <span className="font-bold text-slate-950">{row.email}</span>
                  <span className="text-xs text-brand-muted">
                    {active ? <>Unsubscribed <LocalTime iso={row.unsubscribedAt} mode="datetime" /> · {row.unsubscribedSource === "crew" ? "by the crew" : "from the link in a message"}</> : <>Back on the list since <LocalTime iso={row.resubscribedAt || row.unsubscribedAt} mode="datetime" /></>}
                  </span>
                  <form action={setUnsubscribeAction} className="ml-auto">
                    <fieldset disabled={Boolean(denied)} className="contents">
                      <input type="hidden" name="email" value={row.email} />
                      <input type="hidden" name="intent" value={active ? "resubscribe" : "unsubscribe"} />
                      <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40" data-testid={`unsubscribe-toggle-${row.email}`}>
                        {active ? "Put them back on" : "Take them off again"}
                      </button>
                    </fieldset>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4"><EmptyState title="Nobody has unsubscribed" body="Every group send carries an unsubscribe link. Anyone who uses it appears here and drops out of every future group send." /></div>
        )}
      </div>
    </SectionCard>
  );
}
