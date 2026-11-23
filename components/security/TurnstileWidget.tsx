"use client";

import Script from "next/script";

/**
 * Cloudflare Turnstile inside a form. The script finds the `.cf-turnstile` box, runs its check (most
 * people never see a puzzle) and adds the hidden `cf-turnstile-response` field the server verifies
 * (lib/security/turnstile.ts). If the script is blocked the form still submits without the field,
 * and the server treats that as unchecked, under its own tighter cap; nobody is refused for an ad
 * blocker. No site key configured renders nothing.
 */
export function TurnstileWidget({ siteKey, action }: { siteKey: string; action: string }) {
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      {/* Cloudflare's box is never narrower than 300 px, wider than a 320 px phone's form column (it pushed
          /request-event 25 px off screen, 23 Nov 2026). Below 360 px it is drawn at 85%, so it fits. */}
      <div className="cf-turnstile min-h-[65px] origin-top-left max-[359px]:scale-[0.85]" data-sitekey={siteKey} data-action={action} data-theme="light" data-size="flexible" data-testid="turnstile-widget" />
    </>
  );
}
