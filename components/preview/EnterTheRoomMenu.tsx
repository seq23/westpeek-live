import { PREVIEW_PERSONAS } from "@/lib/auth/previewIdentity";
import { readViewAsViewer } from "@/lib/auth/viewAs";
import { guestPreviewLinks } from "@/components/guests/GuestPreviewLinks";
import { listGuestProfiles } from "@/services/guests/guestIdentityService";

const ROLE_WORD = { speaker: "speaker", sponsor: "sponsor", vip: "VIP", client: "client" } as const;

/**
 * "Enter the room as…" — the one control that answers both halves of "get me into the room".
 *
 * **Myself (host)** is the default and needs no code and no registration: the owner cookie already
 * authorises `/venue/**`, there was simply never a link. Then the five preview personas, which read
 * the event's real configuration and can be used on a brand-new event where nobody has entered a
 * role code yet. Then, below a divider, the event's REAL guests on today's `?viewAs={guestId}`
 * behaviour, unchanged.
 *
 * Deliberately self-contained: a `<details>` with no client JavaScript and no dependency on any
 * surrounding chrome, so it drops into the Event Command Bar, an Owner Console row, or the event
 * workspace header without changing. It renders nothing at all for anyone `canViewAsGuest` refuses,
 * so it is safe wherever it is dropped.
 */
export async function EnterTheRoomMenu({ eventId, clientSlug, returnTo, compact = false }: { eventId: string; clientSlug?: string; returnTo?: string; compact?: boolean }) {
  const viewer = await readViewAsViewer(eventId);
  if (!viewer.ok) return null;
  const guests = await listGuestProfiles(eventId).catch(() => []);
  const back = encodeURIComponent(returnTo || `/app/events/${eventId}`);
  const entry = "block rounded-xl px-3 py-2 text-left text-xs font-bold text-brand-black hover:bg-brand-ash";
  return (
    <details className="relative" data-testid="enter-the-room-menu" data-event={eventId}>
      <summary className={`cursor-pointer list-none rounded-full border border-brand-black font-black hover:border-brand-orange hover:text-brand-orange ${compact ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-xs"}`} data-testid="enter-the-room-trigger">Enter the room ▾</summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-brand-line bg-white p-2 shadow-lg" data-testid="enter-the-room-panel">
        <a href={`/venue/${eventId}/stage`} className={`${entry} !font-black text-brand-orange`} data-testid="enter-as-host">
          Myself (host)
          <span className="mt-0.5 block text-[11px] font-medium text-brand-muted">Your own identity, full controls. No code, no registration.</span>
        </a>
        <p className="mt-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Preview as</p>
        {PREVIEW_PERSONAS.map((persona) => (
          <a key={persona.id} href={`${persona.path(eventId, clientSlug)}?viewAs=${persona.id}&leaveTo=${back}`} className={entry} data-testid={`enter-as-${persona.id}`}>
            {persona.menuLabel}
            <span className="mt-0.5 block text-[11px] font-medium text-brand-muted">Read-only. Nothing is saved and nobody else can see it.</span>
          </a>
        ))}
        <hr className="my-2 border-brand-line" data-testid="enter-the-room-divider" />
        <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Real guests</p>
        {guests.length ? guests.map((guest) => (
          <a key={guest.guestId} href={guestPreviewLinks(eventId, guest, clientSlug)[0].href} className={entry} data-testid={`enter-as-guest-${guest.guestId}`}>
            {guest.name}
            <span className="mt-0.5 block text-[11px] font-medium text-brand-muted">{ROLE_WORD[guest.role]}{guest.company ? ` · ${guest.company}` : ""} — their real state</span>
          </a>
        )) : <p className="px-3 py-2 text-[11px] text-brand-muted" data-testid="enter-the-room-no-guests">Nobody has entered a role code yet. The personas above work before anyone arrives.</p>}
      </div>
    </details>
  );
}
