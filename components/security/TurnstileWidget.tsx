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
      {/* Cloudflare's box is never narrower than 300 px, wider than a 320 px phone's form column: it pushed the
          whole /request-event form 25 px off screen (23 Nov 2026). Below 360 px the frame holds 228 x 50 px of
          room and the box inside is drawn at 76% (a scale alone still takes 300 px of layout). */}
      <div className="max-[359px]:h-[50px] max-[359px]:w-[228px] max-[359px]:overflow-hidden">
        <div className="cf-turnstile min-h-[65px] max-[359px]:w-[300px] max-[359px]:origin-top-left max-[359px]:scale-[0.76]" data-sitekey={siteKey} data-action={action} data-theme="light" data-size="flexible" data-testid="turnstile-widget" />
      </div>
    </>
  );
}
