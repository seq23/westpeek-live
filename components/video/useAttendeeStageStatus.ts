"use client";
import { useEffect, useState } from "react";
import type { AttendeeStageStatus } from "@/services/venue/attendeeStageStatus";

export type AttendeeStageStatusSnapshot = AttendeeStageStatus & { attendeeId: string | null; updatedAt?: string };

/**
 * Polls the attendee's OWN stage status (~5s) so "Requested" becomes "Approved" and "Approved"
 * becomes "Removed by the crew" without a reload. Off for anyone who is not a registered attendee.
 */
export function useAttendeeStageStatus(eventId: string, roomId: string, initial: AttendeeStageStatusSnapshot | undefined, enabled: boolean, intervalMs = 5_000) {
  const [snapshot, setSnapshot] = useState<AttendeeStageStatusSnapshot | undefined>(initial);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/attendee-live/mine?eventId=${encodeURIComponent(eventId)}&roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
        const json = await response.json();
        if (!cancelled && json.ok) setSnapshot(json as AttendeeStageStatusSnapshot);
      } catch {
        // keep the last good snapshot
      }
    }
    poll();
    const interval = window.setInterval(poll, intervalMs);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [eventId, roomId, enabled, intervalMs]);
  return snapshot;
}
