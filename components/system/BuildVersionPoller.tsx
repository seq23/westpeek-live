"use client";
import { useEffect } from "react";
import { notifyServerBuildId } from "@/components/system/BuildVersionWatchdog";

/**
 * Pages outside the venue have no other poll to carry the build id, so this one asks for it.
 *
 * It asks every 30 seconds while the tab is visible AND the moment the tab comes back — the case
 * the owner hit on 16 Sep 2026 was a console left open across a deploy: a tab that has been in the
 * background all along should not wait another half minute after she returns to it, and a page
 * opened before this poller existed could not ask at all (which is why nothing happened for her).
 * One tiny JSON answer, no store read.
 */
export function BuildVersionPoller({ intervalMs = 30_000 }: { intervalMs?: number }) {
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
    const wake = () => { void ask(); };
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    document.addEventListener("visibilitychange", wake);
    void ask();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [intervalMs]);
  return null;
}
