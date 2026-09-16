import { redirect } from "next/navigation";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

/**
 * Every event route is keyed by the event id. A join code in that slot — the owner typed
 * /crew/events/wpl-vxckx6 on 16 Sep 2026 — hydrates the event fine but then every roster, chat and
 * stage query below runs against the code, and the page comes back empty and control-less. A
 * layout for each event area calls this: whatever was typed, land on the canonical id.
 */
export async function canonicalEventIdOrRedirect(param: string, areaRoot: (eventId: string) => string): Promise<string> {
  const record = await ensureRuntimeEvent(param);
  // Seed aliases (demo ↔ event-summit) are understood everywhere; redirecting them to the area
  // root sent /venue/demo/stage to /venue/event-summit, which had no page (404, found 16 Sep 2026).
  if (record && record.id !== param && record.source !== "seed") redirect(areaRoot(record.id));
  return record?.id ?? param;
}
