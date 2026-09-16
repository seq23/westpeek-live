import { CopyButton } from "@/components/shared/CopyButton";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { mintHostLinkAction, revokeHostLinksAction } from "@/lib/actions/hostActions";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { getHostLinkState, hostLinkUrl } from "@/services/events/hostLinkService";
import { findEventRecord } from "@/services/events/eventRepository";

function when(value: string) {
  return new Date(value).toLocaleString();
}

/**
 * "Make someone the host." The host of an event is the executive_producer crew role for that one
 * event. One click mints a host link — the crew gate prefilled with the event code, the role, and
 * the event's crew code (the person still presses Enter) — with Copy. The current hosts list is
 * the links handed out (who minted, when) plus anyone here as owner / operator / executive
 * producer. "Revoke host link" rotates the event's crew code: every link and every crew cookie
 * minted with the old code stops working. Seed events have no crew code on the row, so nothing to mint.
 */
export async function HostPanel({ eventId, viewer: givenViewer, compact = false }: { eventId: string; viewer?: CrewViewer; compact?: boolean }) {
  const [event, state, viewer] = await Promise.all([findEventRecord(eventId).catch(() => undefined), getHostLinkState(eventId), givenViewer ? Promise.resolve(givenViewer) : getCrewViewer(eventId)]);
  if (!event || event.source === "seed") return null;
  const link = await hostLinkUrl(event);
  const active = state.links.filter((item) => !item.revokedAt);
  const youAreHost = viewer.isHost;
  return (
    <section className="rounded-3xl border border-brand-orange/40 bg-white p-5 shadow-sm" data-testid="host-panel" data-active-links={active.length} data-code-version={state.codeVersion}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Host</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">{youAreHost ? `You are hosting${viewer.kind === "crew" ? " as the Executive Producer" : ` as the ${viewer.label.toLowerCase()}`}.` : "Who is running this show"}</h2>
          {!compact ? <p className="mt-2 max-w-2xl text-sm text-slate-600">The host is the Executive Producer of this one event: go-live, end-the-show, and every control, nothing else. Hand it to someone with one link; take it back by revoking, which rotates the crew code.</p> : null}
        </div>
        <GatedForm viewer={viewer} action="manage_host" formAction={mintHostLinkAction} testId="mint-host-link-form">
          <input type="hidden" name="eventId" value={eventId} />
          <button className="rounded-full bg-brand-black px-5 py-3 text-sm font-black text-white hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-40" data-testid="mint-host-link">Make someone the host</button>
        </GatedForm>
      </div>
      <DeniedNote viewer={viewer} action="manage_host" className="mt-3" />

      {active.length ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-testid="host-link-card">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Host link · this event only</p>
          <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-900" data-testid="host-link-url">{link}</code>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CopyButton value={link} label="Copy host link" testId="copy-host-link" />
            <GatedForm viewer={viewer} action="manage_host" formAction={revokeHostLinksAction} className="inline" testId="revoke-host-link-form">
              <input type="hidden" name="eventId" value={eventId} />
              <button className="rounded-full border border-rose-300 px-4 py-2 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-40" data-testid="revoke-host-link">Revoke host link</button>
            </GatedForm>
          </div>
          <p className="mt-2 text-sm font-bold text-emerald-900">Send this to whoever is running the show. They get the host banner, go-live, end-the-show and every control for this event only.</p>
          <p className="mt-1 text-xs text-emerald-900/80">The link prefills the crew gate; they still press Enter crew workspace. Revoking rotates the crew code, so the link and anyone who entered with it stop working.</p>
        </div>
      ) : <p className="mt-4 text-sm text-slate-600" data-testid="host-link-none">{state.codeVersion ? `No active host link. The crew code was rotated ${state.rotatedAt ? when(state.rotatedAt) : ""} by ${state.rotatedBy || "the owner"}; mint a new one to hand the show to someone.` : "No host link handed out yet. Until then the owner and the operator are the hosts."}</p>}

      <div className="mt-4" data-testid="current-hosts">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Current hosts</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>Owner and operator cookies — always.</li>
          {youAreHost && viewer.kind === "crew" ? <li data-testid="current-host-you">You, as the Executive Producer of this event.</li> : null}
          {active.map((item, index) => <li key={item.id} data-testid={`host-link-grant-${item.id}`}>Host link #{active.length - index} · handed out by {item.grantedBy} · {when(item.grantedAt)}</li>)}
          {state.links.filter((item) => item.revokedAt).slice(0, 3).map((item) => <li key={item.id} className="text-slate-400 line-through">Host link · by {item.grantedBy} · revoked {when(item.revokedAt!)}</li>)}
        </ul>
      </div>
    </section>
  );
}
