"use client";
import { useEffect } from "react";
import { notifyServerBuildId } from "@/components/system/BuildVersionWatchdog";

/**
 * Pages outside the venue have no other poll to carry the build id, so this one asks for it —
 * once a minute, one tiny JSON answer, and only while the tab is visible.
 */
export function BuildVersionPoller({ intervalMs = 60_000 }: { intervalMs?: number }) {
  useEffect(() => {
    let cancelled = false;
    const ask = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/runtime/build-id", { cache: "no-store" });
        const payload = (await response.json()) as { buildId?: string };
        if (!cancelled) notifyServerBuildId(payload?.buildId);
      } catch { /* offline or mid-deploy: the next tick asks again */ }
    };
    const timer = window.setInterval(ask, intervalMs);
    void ask();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [intervalMs]);
  return null;
}
