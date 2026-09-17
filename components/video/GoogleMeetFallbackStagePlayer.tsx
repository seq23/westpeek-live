"use client";

/**
 * The last rung, and the only one that takes the attendee off our page.
 *
 * Every rung above this one swaps the picture and says nothing, because the attendee does not need
 * to know which provider is carrying the show. This one is different: the show is somewhere else
 * now, and a person sitting on a page that has gone quiet has no way to find out. So it is a panel,
 * in place, that says the show has moved, says where, and says plainly what does not come with them
 * — never a silent redirect, and never a click they have to guess at.
 *
 * It appears and disappears on its own. The stage player polls the state every ten seconds, so
 * moving down puts this in front of everyone already watching, and moving back up when LiveKit or
 * Cloudflare recovers takes it away again and returns them to the venue stage. No reload either way.
 */
export function GoogleMeetFallbackStagePlayer({ fallbackUrl, eventName }: { fallbackUrl?: string; eventName?: string }) {
  return (
    <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white" data-testid="google-meet-moved-panel" data-has-link={fallbackUrl ? "true" : "false"}>
      <div className="max-w-lg">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">The show has moved</p>
        <h2 className="mt-3 text-2xl font-black">{eventName ? `${eventName} is continuing in a Google Meet room` : "This session is continuing in a Google Meet room"}</h2>
        <p className="mt-3 text-sm text-slate-300">We hit a problem with the stream, so the production team has moved everyone to a backup room. Open it and you will be back with the show.</p>
        {fallbackUrl ? (
          <>
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950" data-testid="google-meet-open-link">Open the Meet room</a>
            <p className="mt-3 break-all text-xs text-slate-400" data-testid="google-meet-link-text">{fallbackUrl}</p>
            {/* Honest about what is lost. The Meet room is not the venue and cannot pretend to be. */}
            <p className="mt-4 text-xs text-slate-400">The chat, the attendee list and networking stay on this page and do not come with you. Use the Meet room&rsquo;s own chat, and keep this tab open — if the stream comes back, the show returns here and this panel disappears.</p>
          </>
        ) : (
          <p className="mt-5 rounded-2xl border border-white/15 p-4 text-sm" data-testid="google-meet-link-pending">The backup room link is being prepared. Stay on this page — it will appear here as soon as the production team has it.</p>
        )}
      </div>
    </div>
  );
}
