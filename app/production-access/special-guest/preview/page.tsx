import { LegalFooter } from "@/components/legal/LegalFooter";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WestPeekProductionsLogoHomeLink } from "@/components/brand/WestPeekProductionsLogo";
import { GuestPreviewList } from "@/components/guests/GuestPreviewLinks";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { findEventRecord } from "@/services/events/eventRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

const ROLE_ROWS = [["speaker", "Speaker"], ["sponsor", "Sponsor"], ["vip", "VIP"], ["client", "Client"]] as const;

/**
 * Where the owner master password lands from the special-guest gate: "Preview a guest" for the
 * event code that was typed. Every special guest of that event with the open-as links (their real
 * green room / teleprompter / booth / lounge / overview, read-mostly, banner on top), plus the
 * event's role codes so the owner can hand them out. Owner cookie only; anyone else is sent to the
 * owner gate with this page as `next`.
 */
export default async function PreviewGuestPage({ searchParams }: { searchParams?: Promise<{ event?: string }> }) {
  const query = searchParams ? await searchParams : undefined;
  const eventCode = String(query?.event || "").trim().slice(0, 80);
  const self = `/production-access/special-guest/preview${eventCode ? `?event=${encodeURIComponent(eventCode)}` : ""}`;
  let owner;
  try {
    const env = getEnv();
    owner = await readV5AccessCookie((await cookies()).get(getV5AccessCookieNames(env).ownerCookieName)?.value, getV5AccessCookieSecret(env));
  } catch { owner = undefined; }
  if (owner?.kind !== "owner") redirect(`/production-access/owner?next=${encodeURIComponent(self)}`);

  const runtime = eventCode ? await ensureRuntimeEvent(eventCode) : undefined;
  const record = eventCode ? await findEventRecord(eventCode).catch(() => undefined) : undefined;
  const event = runtime || record;
  const eventId = event?.id;
  const accessHref = eventId ? `/app/events/${eventId}/access` : "/app/events";
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10" data-testid="preview-guest-page" data-event-id={eventId || ""}>
          <WestPeekProductionsLogoHomeLink size="md" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Preview a guest</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">{event ? event.name : "Which event?"}</h1>
          <p className="mt-4 text-sm leading-6 text-brand-muted">You entered with the owner master password. Rather than the workspace, here is every special guest of {event ? "this event" : "the event"} with a link that opens their real page as them — read-mostly, with a banner only you see.</p>

          {!event ? (
            <form method="get" action="/production-access/special-guest/preview" className="mt-6 flex flex-wrap items-end gap-3" data-testid="preview-event-form">
              <label className="grid gap-1 text-sm font-black">Event code<input name="event" defaultValue={eventCode} required className="min-h-12 rounded-full border border-brand-line px-5 text-sm font-normal" placeholder="wpl-xxxxxx or the slug" /></label>
              <button className="min-h-12 rounded-full bg-brand-black px-6 text-sm font-bold text-white">Show guests</button>
              {eventCode ? <p className="w-full rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800" data-testid="preview-event-unknown">No event matches &ldquo;{eventCode}&rdquo;. Use the event code or the slug from the workspace.</p> : null}
            </form>
          ) : (
            <>
              <div className="mt-6"><GuestPreviewList eventId={eventId!} clientSlug={event.clientSlug} emptyHref={accessHref} /></div>
              {runtime && runtime.source !== "seed" ? (
                <section className="mt-6 rounded-2xl bg-brand-ash p-4" data-testid="preview-role-codes">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-muted">Role codes for {event.name}</p>
                  <p className="mt-1 text-xs text-brand-muted">Event code <strong>{runtime.joinCode}</strong> plus one of these at the special-guest gate.</p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {ROLE_ROWS.map(([key, label]) => <div key={key} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm"><dt className="font-black">{label}</dt><dd><code className="font-mono" data-testid={`preview-code-${key}`}>{runtime.accessCodes[key]}</code></dd></div>)}
                  </dl>
                </section>
              ) : <p className="mt-6 rounded-2xl bg-brand-ash p-4 text-xs text-brand-muted">Seed events keep their role codes as Cloudflare secrets; they are never shown here.</p>}
              <div className="mt-6 flex flex-wrap gap-2 text-sm">
                <a href={accessHref} className="rounded-full border border-brand-black px-4 py-2 font-bold hover:border-brand-orange hover:text-brand-orange" data-testid="preview-access-page">Access page</a>
                <a href={`/crew/events/${eventId}`} className="rounded-full border border-brand-black px-4 py-2 font-bold hover:border-brand-orange hover:text-brand-orange">Crew deck</a>
                <a href="/app" className="rounded-full border border-brand-black px-4 py-2 font-bold hover:border-brand-orange hover:text-brand-orange" data-testid="preview-workspace">Workspace</a>
              </div>
            </>
          )}
        </section>
      </main>
      <LegalFooter variant="compact" />
    </>
  );
}
