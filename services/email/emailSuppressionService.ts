import { getV5AccessCookieSecret, getEnv } from "@/lib/env";
import { base64UrlEncode, hmacSha256Base64Url, sha256Hex } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { unsubscribeIsActive, type EmailUnsubscribeRecord } from "@/types/emailAudience";

/**
 * West Peek's unsubscribe list, and the token that gets somebody onto it.
 *
 * The rule the whole feature turns on: a GROUP send is bulk email and honours this list; a
 * TRANSACTIONAL send to one named person does not. A speaker who unsubscribed from announcements
 * still gets their own green room link, because that message is addressed to them and they are
 * waiting for it. Nothing in this file is ever called from the transactional path — that is the
 * enforcement, and `groupEmailService` is the only caller.
 *
 * The list is per PERSON and across every event. Unsubscribing from one summit's announcement takes
 * the person out of every future group send for every event, because from where they are sitting it
 * is all "West Peek emailing me".
 */
const TOKEN_VERSION = "u1";

function normalize(email: string) {
  return String(email || "").trim().toLowerCase();
}

function signingSecret() {
  // The same secret that signs the access cookies. A token is a capability, not a session, but the
  // requirement is identical: unguessable without the secret, and verifiable without a lookup.
  return getV5AccessCookieSecret(getEnv());
}

/**
 * The link in the footer: `v1.<base64url(email)>.<hmac>`.
 *
 * The address is IN the token and the signature covers it, so a token cannot be replayed for
 * somebody else — flipping a character in the address invalidates the signature, and there is no
 * sequential id to walk. It deliberately does not expire: an unsubscribe link in a two-year-old
 * message must still work, or the person's only recourse is the spam button.
 */
export async function buildUnsubscribeToken(email: string) {
  const address = normalize(email);
  const payload = `${TOKEN_VERSION}.${base64UrlEncode(address)}`;
  return `${payload}.${await hmacSha256Base64Url(payload, signingSecret())}`;
}

/** The address a token vouches for, or undefined when it was tampered with, truncated or forged. */
export async function readUnsubscribeToken(token: string): Promise<string | undefined> {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return undefined;
  const payload = `${parts[0]}.${parts[1]}`;
  let expected: string;
  try {
    expected = await hmacSha256Base64Url(payload, signingSecret());
  } catch {
    return undefined;
  }
  if (!constantTimeEquals(expected, parts[2])) return undefined;
  try {
    const decoded = new TextDecoder().decode(base64UrlDecode(parts[1]));
    const address = normalize(decoded);
    return address.includes("@") ? address : undefined;
  } catch {
    return undefined;
  }
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Length-independent comparison: a token check must not leak the signature one byte at a time. */
function constantTimeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function unsubscribeUrl(baseUrl: string, email: string) {
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(await buildUnsubscribeToken(email))}`;
}

/** Puts somebody on the list. Idempotent: pressing the link twice is the same as pressing it once. */
export async function recordUnsubscribe(input: { email: string; source: "one_click" | "crew"; eventId?: string }) {
  const email = normalize(input.email);
  if (!email.includes("@")) throw new Error("That is not an address we can unsubscribe.");
  const record: EmailUnsubscribeRecord = {
    email,
    emailHash: await sha256Hex(email),
    unsubscribedAt: new Date().toISOString(),
    unsubscribedSource: input.source,
    lastEventId: input.eventId,
  };
  await getRuntimeStore().upsertEmailUnsubscribe(record);
  return record;
}

/**
 * The way back in for somebody who pressed it by mistake. The unsubscribe row is kept and a later
 * `resubscribedAt` overrides it, so the history of "she asked to stop, then asked to start again"
 * survives rather than being deleted into a clean-looking table.
 */
export async function recordResubscribe(input: { email: string; by: string }) {
  const email = normalize(input.email);
  const store = getRuntimeStore();
  const existing = await store.getEmailUnsubscribe(email).catch(() => undefined);
  if (!existing) return undefined;
  const record: EmailUnsubscribeRecord = { ...existing, resubscribedAt: new Date().toISOString(), resubscribedBy: input.by };
  await store.upsertEmailUnsubscribe(record);
  return record;
}

export async function findUnsubscribe(email: string) {
  return getRuntimeStore().getEmailUnsubscribe(normalize(email)).catch(() => undefined);
}

export async function isUnsubscribed(email: string) {
  const record = await findUnsubscribe(email);
  return Boolean(record && unsubscribeIsActive(record));
}

/** Every address currently suppressed, as a set the audience resolver can subtract in one pass. */
export async function suppressedAddresses(): Promise<Set<string>> {
  const rows = await getRuntimeStore().listEmailUnsubscribes().catch(() => [] as EmailUnsubscribeRecord[]);
  return new Set(rows.filter(unsubscribeIsActive).map((row) => row.email));
}

export async function listUnsubscribes() {
  return (await getRuntimeStore().listEmailUnsubscribes().catch(() => [] as EmailUnsubscribeRecord[]))
    .slice()
    .sort((a, b) => b.unsubscribedAt.localeCompare(a.unsubscribedAt));
}
