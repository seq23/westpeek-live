import { CopyButton } from "@/components/shared/CopyButton";
import { getEnv } from "@/lib/env";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

import { headers } from "next/headers";

/**
 * The link a partner copies must be the one guests can open. NEXT_PUBLIC_APP_URL defaults to
 * http://localhost:3000 and on 15 Sep 2026 that is exactly what the lobby handed the owner to send
 * out. The request's own host is the truth; the configured value is used only when it is a real
 * public origin; the production domain is the last resort.
 */
async function appBaseUrl() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
      const proto = h.get("x-forwarded-proto") || "https";
      return `${proto}://${host}`;
    }
  } catch {
    // no request scope (tests, build): fall through
  }
  try {
    const configured = getEnv().NEXT_PUBLIC_APP_URL;
    if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured.replace(/\/$/, "");
  } catch {
    // fall through
  }
  return "https://westpeek.live";
}

export async function joinLinkFor(event: Pick<RuntimeEventRecord, "joinCode">) {
  return `${await appBaseUrl()}/join?code=${encodeURIComponent(event.joinCode)}`;
}

export async function EventJoinCodePanel({ event, tone = "light", headline }: { event: RuntimeEventRecord; tone?: "light" | "dark"; headline?: string }) {
  const link = await joinLinkFor(event);
  const dark = tone === "dark";
  return (
    <section className={`rounded-3xl p-5 shadow-sm ${dark ? "bg-brand-black text-white" : "border border-brand-line bg-white text-brand-black"}`} data-testid="event-join-code-panel">
      <p className={`text-xs font-black uppercase tracking-[0.25em] ${dark ? "text-brand-orange" : "text-brand-orange"}`}>{headline || (event.status === "live" ? "Live now · share this code" : "Join code")}</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`text-4xl font-black tracking-tight ${dark ? "text-white" : "text-brand-black"}`} data-testid="event-join-code">{event.joinCode}</p>
          <p className={`mt-1 break-all text-sm ${dark ? "text-white/70" : "text-brand-muted"}`} data-testid="event-join-link">{link}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={event.joinCode} label="Copy code" testId="copy-join-code" className={dark ? "border-white text-white hover:border-brand-orange" : ""} />
          <CopyButton value={link} label="Copy join link" testId="copy-join-link" className={dark ? "border-white text-white hover:border-brand-orange" : ""} />
        </div>
      </div>
      <p className={`mt-3 text-xs ${dark ? "text-white/60" : "text-brand-muted"}`}>Anyone with the code lands in the lobby via /join. Crew, speaker, sponsor, VIP, and client codes are on the Access page.</p>
    </section>
  );
}
