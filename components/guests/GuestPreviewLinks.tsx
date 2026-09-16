import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import type { SpecialGuestProfile, SpecialGuestRole } from "@/types/specialGuest";

/** The "open as" links for one guest: their real pages with ?viewAs=<guestId>. */
export function guestPreviewLinks(eventId: string, guest: Pick<SpecialGuestProfile, "guestId" | "role">, clientSlug?: string): Array<{ label: string; href: string; testId: string }> {
  const q = `?viewAs=${encodeURIComponent(guest.guestId)}`;
  if (guest.role === "speaker") return [
    { label: "Open their green room", href: `/speaker/events/${eventId}/green-room${q}`, testId: `open-green-room-${guest.guestId}` },
    { label: "Open their teleprompter", href: `/speaker/events/${eventId}/teleprompter${q}`, testId: `open-teleprompter-${guest.guestId}` },
  ];
  if (guest.role === "sponsor") return [{ label: "Open their booth", href: `/sponsor/events/${eventId}/booth${q}`, testId: `open-booth-${guest.guestId}` }];
  if (guest.role === "vip") return [{ label: "Open their lobby", href: `/venue/${eventId}/lobby${q}`, testId: `open-vip-lobby-${guest.guestId}` }];
  return [{ label: "Open their overview", href: `/client/${clientSlug || "west-peek"}/events/${eventId}${q}`, testId: `open-client-overview-${guest.guestId}` }];
}

export function GuestPreviewLinkRow({ eventId, guest, clientSlug, compact = false }: { eventId: string; guest: SpecialGuestProfile; clientSlug?: string; compact?: boolean }) {
  return (
    <span className="flex flex-wrap gap-2" data-testid={`guest-preview-links-${guest.guestId}`}>
      {guestPreviewLinks(eventId, guest, clientSlug).map((link) => (
        <a key={link.href} href={link.href} className={`rounded-full border border-brand-orange/50 bg-white font-black text-brand-orange hover:bg-brand-orange hover:text-white ${compact ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-xs"}`} data-testid={link.testId}>{link.label}</a>
      ))}
    </span>
  );
}

const ROLE_ORDER: SpecialGuestRole[] = ["speaker", "sponsor", "vip", "client"];
const ROLE_LABEL: Record<SpecialGuestRole, string> = { speaker: "Speakers", sponsor: "Sponsors", vip: "VIPs", client: "Clients" };

/**
 * Every special guest of the event, by role, with the open-as links. On the Access page and the
 * owner's "Preview a guest" page. Guests appear once they have entered with their role code and
 * given their name; until then the role code itself is the only thing to hand out.
 */
export async function GuestPreviewList({ eventId, clientSlug, emptyHref }: { eventId: string; clientSlug?: string; emptyHref?: string }) {
  const guests = await listGuestProfiles(eventId).catch(() => []);
  if (!guests.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600" data-testid="guest-preview-empty">
        No special guests yet for this event. Rows appear once someone enters with a speaker, sponsor, VIP, or client code and gives their name.{emptyHref ? <> Hand out the codes from the <a href={emptyHref} className="font-black text-brand-orange underline" data-testid="guest-preview-access-link">Access page</a>.</> : null}
      </p>
    );
  }
  return (
    <div className="space-y-4" data-testid="guest-preview-list">
      {ROLE_ORDER.map((role) => {
        const rows = guests.filter((guest) => guest.role === role);
        if (!rows.length) return null;
        return (
          <section key={role} data-testid={`guest-preview-${role}`}>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-muted">{ROLE_LABEL[role]} · {rows.length}</p>
            <ul className="mt-2 space-y-2">
              {rows.map((guest) => (
                <li key={guest.guestId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line bg-white p-3" data-testid={`guest-preview-row-${guest.guestId}`}>
                  <span className="text-sm"><strong className="text-brand-black">{guest.name}</strong>{guest.company ? <span className="text-brand-muted"> · {guest.company}</span> : null}{guest.title ? <span className="text-brand-muted"> · {guest.title}</span> : null}</span>
                  <GuestPreviewLinkRow eventId={eventId} guest={guest} clientSlug={clientSlug} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
