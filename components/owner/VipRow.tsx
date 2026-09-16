import { LocalTime } from "@/components/shared/LocalTime";
import { setVipInviteListAction } from "@/lib/actions/vipActions";
import { displayCode } from "@/lib/access/accessCodes";
import { getVipInviteList, listVipStanding } from "@/services/guests/vipGrantService";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * Per event: who is a VIP, how they became one, and which code version they hold. Nobody is here
 * because a flag was set — every line traces back to the event's VIP code, and rotating that code
 * moves everyone admitted under the old one into "no longer current".
 */
export async function VipRow({ event }: { event: RuntimeEventRecord }) {
  const [standing, invites] = await Promise.all([listVipStanding(event.id).catch(() => []), getVipInviteList(event.id).catch(() => ({ emails: [], updatedBy: "", updatedAt: "" }))]);
  const current = standing.filter((grant) => grant.current);
  const lapsed = standing.filter((grant) => !grant.current);
  return (
    <li className="rounded-2xl border border-brand-line p-3" data-testid={`console-vip-${event.id}`} data-current={current.length} data-lapsed={lapsed.length}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black">{event.name}</p>
        <p className="text-xs text-brand-muted">VIP code <code className="rounded bg-brand-ash px-1">{displayCode(event.accessCodes.vip)}</code> · {current.length} VIP{current.length === 1 ? "" : "s"}{lapsed.length ? ` · ${lapsed.length} lapsed` : ""}</p>
      </div>
      {current.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {current.map((grant) => (
            <li key={grant.attendeeId} data-testid={`console-vip-${event.id}-${grant.attendeeId}`}>
              <strong className="text-brand-black">{grant.name}</strong> · {grant.reason} · <LocalTime iso={grant.grantedAt} mode="datetime" /> · code v{grant.codeVersion}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-brand-muted">Nobody holds this event&rsquo;s VIP code yet.</p>}
      {lapsed.length ? (
        <details className="mt-2 text-xs" data-testid={`console-vip-lapsed-${event.id}`}>
          <summary className="cursor-pointer font-black">No longer current ({lapsed.length})</summary>
          <ul className="mt-1 space-y-1">{lapsed.map((grant) => <li key={grant.attendeeId}>{grant.name} · {grant.reason}</li>)}</ul>
        </details>
      ) : null}
      <form action={setVipInviteListAction} className="mt-3 text-xs" data-testid={`console-vip-invites-${event.id}`}>
        <input type="hidden" name="eventId" value={event.id} />
        <label className="font-black">VIP invite list</label>
        <p className="text-brand-muted">Addresses here are issued the VIP code the moment they register — a pre-authorisation of the code, not a way around it.</p>
        <textarea name="emails" defaultValue={invites.emails.join("\n")} placeholder="one address per line" className="mt-1 min-h-20 w-full rounded-xl border border-brand-line px-2 py-1" data-testid={`console-vip-invite-input-${event.id}`} />
        <button className="mt-1 rounded-full bg-brand-black px-3 py-1 font-black text-white" data-testid={`console-vip-invite-save-${event.id}`}>Save the list</button>
      </form>
    </li>
  );
}
