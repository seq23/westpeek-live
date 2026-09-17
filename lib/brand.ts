export const PRODUCT_NAME = "West Peek Live!";
export const BRAND_ORGANIZATION = "West Peek";
export const BRAND_TAGLINE = "Virtual event production platform by West Peek.";
export const BRAND_REPLY_TO = "hello@westpeek.live";
export const BRAND_FROM_EMAIL = "notifications@events.westpeek.live";

/**
 * The one domain West Peek Live is allowed to send as.
 *
 * This is not a style rule, it is what the DNS says. `events.westpeek.live` is the domain carrying
 * the Resend records — the DKIM key at `resend._domainkey.events.westpeek.live`, and the SES
 * return-path under `send.events.westpeek.live` — so it is the only identity Resend will accept
 * from this account. The apex `westpeek.live` carries a Cloudflare Email Routing SPF and MX for
 * RECEIVING mail; it has no DKIM key, so a send claiming to be from the apex is rejected by Resend
 * and, if it ever escaped, would fail DMARC alignment at the recipient.
 */
export const BRAND_SENDING_DOMAIN = "events.westpeek.live";

/** The bare address out of either `addr@host` or `Name <addr@host>`. "" when there is not one. */
export function emailAddressOf(identity: string): string {
  const raw = String(identity || "").trim();
  const angled = raw.match(/<([^>]+)>/);
  const address = (angled ? angled[1] : raw).trim().toLowerCase();
  return address.includes("@") ? address : "";
}

/** Whether an identity is on the verified sending domain, and so is a thing Resend will accept. */
export function isBrandSendingIdentity(identity: string): boolean {
  const address = emailAddressOf(identity);
  return address.endsWith(`@${BRAND_SENDING_DOMAIN}`);
}

/**
 * The address a message actually leaves from.
 *
 * A candidate wins only if it is on the verified sending domain. Anything else — an EMAIL_FROM
 * secret someone set to an apex address, a stale row saved in Settings before this rule existed,
 * an empty string — loses to BRAND_FROM_EMAIL.
 *
 * Falling back is strictly better than honouring the candidate: Resend rejects an unverified
 * sending domain outright, so an off-domain from is not "a different address", it is a message that
 * never arrives. The owner's requirement is that mail comes from notifications@, and this is the
 * line that makes that true regardless of what any secret or row happens to hold.
 */
export function resolveSendingIdentity(candidate?: string | null): string {
  return isBrandSendingIdentity(String(candidate || "")) ? String(candidate).trim() : BRAND_FROM_EMAIL;
}

export const brandColors = {
  black: "#050505",
  white: "#ffffff",
  charcoal: "#171717",
  muted: "#737373",
  line: "#e5e5e5",
  orange: "#f05a1a",
};

export function formatProductName() {
  return PRODUCT_NAME;
}
