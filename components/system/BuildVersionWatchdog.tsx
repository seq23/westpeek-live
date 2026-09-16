"use client";
import { useEffect, useState } from "react";
import { buildChanged, CURRENT_BUILD_ID, typingInProgress } from "@/lib/runtime/buildVersion";

const EVENT = "wpl:server-build-id";

/** Called by any poll that receives `buildId` from the server; the watchdog decides. */
export function notifyServerBuildId(buildId: string | null | undefined) {
  if (typeof window === "undefined" || !buildId) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: String(buildId) }));
}

/**
 * When the server answers a poll with a different build id than this page loaded with, a new
 * version is live: say so in one line and reload — but never mid-typing; while a chat input has
 * text the reload waits (rechecked every 2s) until it is empty.
 */
export function BuildVersionWatchdog() {
  const [pending, setPending] = useState<string | undefined>();
  useEffect(() => {
    const onBuild = (event: Event) => {
      const serverBuildId = (event as CustomEvent<string>).detail;
      if (buildChanged(CURRENT_BUILD_ID, serverBuildId)) setPending(serverBuildId);
    };
    window.addEventListener(EVENT, onBuild);
    return () => window.removeEventListener(EVENT, onBuild);
  }, []);
  useEffect(() => {
    if (!pending) return;
    const attempt = () => { if (!typingInProgress(document)) window.location.reload(); };
    attempt();
    const interval = window.setInterval(attempt, 2_000);
    return () => window.clearInterval(interval);
  }, [pending]);
  if (!pending) return <span className="sr-only" data-testid="build-version-watchdog" data-loaded-build={CURRENT_BUILD_ID} />;
  return (
    <div className="rounded-2xl border border-brand-orange bg-brand-orangeSoft px-4 py-2 text-sm font-black text-slate-950" role="status" data-testid="build-version-banner" data-loaded-build={CURRENT_BUILD_ID} data-server-build={pending}>
      A new version is live — reloading{typeof document !== "undefined" && typingInProgress(document) ? " once you send or clear your message" : ""}.
    </div>
  );
}
