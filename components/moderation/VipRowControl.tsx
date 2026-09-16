import { GatedForm } from "@/components/moderation/GatedForm";
import { makeVipAction, removeVipAction } from "@/lib/actions/vipActions";
import type { CrewViewer } from "@/lib/auth/crewViewer";
import type { VipStanding } from "@/services/guests/vipGrantService";

/**
 * "Make VIP" on a roster row. It does not set a flag: it issues this event's VIP code to that
 * person and records who issued it and under which code version — so when the VIP code is rotated,
 * this grant goes with it. The code to send is shown beside the button.
 */
export function VipRowControl({ eventId, attendeeId, name, email, standing, vipCode, viewer }: { eventId: string; attendeeId: string; name: string; email?: string; standing?: VipStanding; vipCode?: string; viewer: CrewViewer }) {
  const current = standing?.current;
  return (
    <span className="inline-flex flex-col gap-1" data-testid={`vip-control-${attendeeId}`} data-vip={current ? "true" : "false"}>
      {current ? (
        <GatedForm viewer={viewer} action="manage_stage_access" formAction={removeVipAction}>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="attendeeId" value={attendeeId} />
          <button className="rounded-full border border-brand-line px-3 py-1 text-xs font-black text-brand-muted disabled:cursor-not-allowed disabled:opacity-40" data-testid={`remove-vip-${attendeeId}`}>Remove VIP</button>
        </GatedForm>
      ) : (
        <GatedForm viewer={viewer} action="manage_stage_access" formAction={makeVipAction}>
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="attendeeId" value={attendeeId} /><input type="hidden" name="name" value={name} />{email ? <input type="hidden" name="email" value={email} /> : null}
          <button className="rounded-full border border-brand-black px-3 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" data-testid={`make-vip-${attendeeId}`}>Make VIP</button>
        </GatedForm>
      )}
      {current ? (
        <span className="text-[11px] text-brand-muted" data-testid={`vip-why-${attendeeId}`}>{standing?.reason}{vipCode ? ` · send them ${vipCode}` : ""}</span>
      ) : standing ? <span className="text-[11px] text-amber-800" data-testid={`vip-why-${attendeeId}`}>{standing.reason}</span> : null}
    </span>
  );
}
