import Link from "next/link";
import { stagePath } from "@/lib/navigation/eventCommandSurfaces";
import { COMMAND_CHIP_MUTED } from "@/components/command/commandChrome";
import { COMMAND_PANEL } from "@/components/command/commandChrome";

/**
 * "Enter the room as…" — the PLACEHOLDER menu (plan §2.2, §2.5).
 *
 * TODO(work/preview-personas): this menu is owned by the `work/preview-personas` branch. That work
 * adds the preview personas (An attendee, A VIP, A speaker, A sponsor, The client), the divider,
 * and the real guests below it, wired through `lib/auth/viewAsGuard.ts`. Do not build personas
 * here. This branch owns only the bar and the one entry that already works.
 *
 * "Myself (host)" works today and must: the owner cookie already authorises `/venue/**`, there was
 * simply no link — the owner typed the URL or went in through the join page like a stranger.
 */
export function EnterTheRoomMenu({ eventId }: { eventId: string }) {
  return (
    <details className="relative" data-testid="command-bar-enter-the-room">
      <summary className={`flex cursor-pointer list-none items-center gap-1 ${COMMAND_CHIP_MUTED}`}>
        Enter the room <span aria-hidden>▾</span>
      </summary>
      <div className={`${COMMAND_PANEL} p-2 xl:left-0 xl:w-72`}>
        <Link href={stagePath(eventId)} className="block rounded-xl px-3 py-2 text-sm font-black text-brand-black hover:bg-brand-ash" data-testid="enter-the-room-myself">
          Myself (host)
          <span className="mt-0.5 block text-[11px] font-bold text-brand-muted">Straight onto the stage with your own identity and the host controls. No code.</span>
        </Link>
        <p className="mt-1 rounded-xl bg-brand-ash px-3 py-2 text-[11px] font-bold text-brand-muted" data-testid="enter-the-room-personas-pending">
          Seeing the room as an attendee, a VIP, a speaker, a sponsor or the client is being built on <code>work/preview-personas</code>. It lands in this menu.
        </p>
      </div>
    </details>
  );
}
