import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { LiveRoomChat } from "@/components/venue/LiveRoomChat";
import { getCurrentGuestIdentity, listGuestProfiles } from "@/services/guests/guestIdentityService";
import { getVipRoom } from "@/services/guests/guestStateService";
import type { ViewAsContext } from "@/lib/auth/viewAs";
import { guestAccessStale } from "@/services/events/accessCodeService";
import { SafeSection } from "@/components/system/SafeSection";

/**
 * What a VIP code holder sees on the lobby: the badge, their name (given once), and the VIP
 * lounge when the crew has opened it. Anyone without the VIP cookie never sees this panel.
 */
export async function VipLobbyPanel({ eventId, error, viewAs, grantedName }: { eventId: string; error?: string; viewAs?: ViewAsContext; grantedName?: string }) {
  const [ownVip, room, vips] = await Promise.all([viewAs ? Promise.resolve(undefined) : getCurrentGuestIdentity(eventId, "vip"), getVipRoom(eventId), listGuestProfiles(eventId, "vip").catch(() => [])]);
  // Someone admitted with the VIP code as a registered attendee holds it just as a gate VIP does.
  const vip: { guestId: string; name: string } | undefined = viewAs?.guest || ownVip || (grantedName ? { guestId: "vip-grant", name: grantedName } : undefined);
  // The VIP code was changed since this cookie was minted: the lounge is closed to it; the badge says why.
  const stale = !viewAs && !grantedName && await guestAccessStale(eventId);
  if (stale) return <section className="rounded-3xl bg-brand-black p-5 text-white" data-testid="vip-lobby-panel" data-vip-stale="true"><p className="text-lg font-black">Your VIP code was changed by the production team.</p><p className="mt-1 text-sm text-white/70">Ask them for the new link, then enter again at the <a href="/production-access/special-guest?error=rotated" className="underline">special-guest gate</a>.</p></section>;
  return (
    <div className="space-y-4" data-testid="vip-lobby-panel" data-vip-room-open={room.open ? "true" : "false"} data-view-as={viewAs?.guest.guestId}>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-brand-black p-5 text-white">
        <div>
          <span className="rounded-full bg-brand-orange px-3 py-1 text-xs font-black uppercase tracking-[0.25em]" data-testid="vip-badge">VIP</span>
          <p className="mt-2 text-lg font-black">{vip ? `Welcome, ${vip.name}.` : "Welcome. Tell us who you are so the crew knows you by name."}</p>
          <p className="text-sm text-white/70">{room.open ? `The ${room.label} is open below.` : "The crew opens the VIP lounge from the console when it is time; you will see it here."}</p>
        </div>
      </section>
      {!vip ? <GuestIdentityForm eventId={eventId} role="vip" returnTo={`/venue/${eventId}/lobby`} error={error} compact /> : null}
      {room.open ? (
        <section className="rounded-3xl border border-brand-orange/40 bg-brand-orangeSoft p-5" data-testid="vip-lounge">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{room.label}</p>
          <p className="mt-2 text-sm text-slate-700">{vips.length} VIP{vips.length === 1 ? "" : "s"} named for this event{vips.length ? `: ${vips.map((item) => item.name).join(", ")}` : ""}. Chat here is VIP-and-crew only; register as an attendee with the event code to post with your identity.</p>
          {viewAs ? <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm text-slate-700" data-testid="vip-chat-preview-disabled">Lounge chat is not shown in preview; open the lounge from the crew deck to read or moderate it as crew.</p> : <div className="mt-4"><SafeSection label="VIP lounge chat" render={() => LiveRoomChat({ eventId: eventId, roomKind: "breakout", roomId: room.roomId, title: room.label, description: "Opened by the crew for VIP guests." })} /></div>}
        </section>
      ) : null}
    </div>
  );
}
