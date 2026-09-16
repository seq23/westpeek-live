import { GuestIdentityForm } from "@/components/guests/GuestIdentityForm";
import { LiveRoomChat } from "@/components/venue/LiveRoomChat";
import { getCurrentGuestIdentity, listGuestProfiles } from "@/services/guests/guestIdentityService";
import { getVipRoom } from "@/services/guests/guestStateService";

/**
 * What a VIP code holder sees on the lobby: the badge, their name (given once), and the VIP
 * lounge when the crew has opened it. Anyone without the VIP cookie never sees this panel.
 */
export async function VipLobbyPanel({ eventId, error }: { eventId: string; error?: string }) {
  const [vip, room, vips] = await Promise.all([getCurrentGuestIdentity(eventId, "vip"), getVipRoom(eventId), listGuestProfiles(eventId, "vip").catch(() => [])]);
  return (
    <div className="space-y-4" data-testid="vip-lobby-panel" data-vip-room-open={room.open ? "true" : "false"}>
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
          <p className="mt-2 text-sm text-slate-700">{vips.length} VIP{vips.length === 1 ? "" : "s"} named for this event{vips.length ? `: ${vips.map((item) => item.name).join(", ")}` : ""}. Chat here is VIP-and-crew only; register as an attendee with the join code to post with your identity.</p>
          <div className="mt-4"><LiveRoomChat eventId={eventId} roomKind="breakout" roomId={room.roomId} title={room.label} description="Opened by the crew for VIP guests." /></div>
        </section>
      ) : null}
    </div>
  );
}
