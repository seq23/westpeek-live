"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a venue page honest about the event's state without a manual refresh: polls the venue
 * gate (~10s) and, the moment it differs from what this page was rendered with (End the show,
 * Archive, Publish), asks Next to re-render the page from the server — which then shows the ended
 * / archived / open state through the same shell rule.
 */
export function VenueStatePoller({ eventId, gate, surface, intervalMs = 10_000 }: { eventId: string; gate: string; surface: "replay" | "other"; intervalMs?: number }) {
  const router = useRouter();
  const rendered = useRef(gate);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/venue/state?eventId=${encodeURIComponent(eventId)}&surface=${surface}`, { cache: "no-store" });
        const json = await response.json();
        if (!cancelled && json.ok && json.gate !== rendered.current) {
          rendered.current = json.gate;
          router.refresh();
        }
      } catch {
        // keep the page as rendered
      }
    }
    const interval = window.setInterval(poll, intervalMs);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [eventId, surface, intervalMs, router]);
  return <span className="sr-only" data-testid="venue-state-poller" data-gate={gate} />;
}
