import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * One case convention for every code (16 Sep 2026): displayed UPPERCASE (WPL-VXCKX6, SPK-WYGJMY,
 * CREW-93H7SD), matched case-insensitively ignoring spaces and dashes — the way the join resolver
 * already forgave a phone's typing. Role codes are stored uppercase; join codes stay stored
 * lowercase (the runtime row's unique column and every existing link) and are displayed uppercase.
 */
export function codeKey(raw: string | undefined | null) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Case- and dash-forgiving, and constant-time over the code's length, so timing says nothing about how much of a guess was right. */
export function codesMatch(a: string | undefined | null, b: string | undefined | null) {
  const left = codeKey(a);
  const right = codeKey(b);
  if (!left.length || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

export function displayCode(code: string | undefined | null) {
  return String(code || "").trim().toUpperCase();
}

/** Stored form of a role code: uppercase, spaces removed. */
export function normalizeRoleCode(raw: string) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Stored form of a join code: lowercase (the row's unique column), spaces removed. */
export function normalizeJoinCode(raw: string) {
  return String(raw || "").trim().toLowerCase().replace(/\s+/g, "");
}

export type AccessCodeField = "join" | "crew" | "speaker" | "sponsor" | "vip" | "client";

/** Letters, digits, hyphens; 4–24 characters; no leading or trailing hyphen. Returns the stored form. */
export function validateCustomCode(raw: string, field: AccessCodeField): { ok: true; stored: string } | { ok: false; reason: string } {
  const stored = field === "join" ? normalizeJoinCode(raw) : normalizeRoleCode(raw);
  if (!/^[A-Za-z0-9-]{4,24}$/.test(stored)) return { ok: false, reason: "A code is 4–24 letters, digits, or hyphens." };
  if (stored.startsWith("-") || stored.endsWith("-")) return { ok: false, reason: "A code cannot start or end with a hyphen." };
  return { ok: true, stored };
}

const GATE: Record<Exclude<AccessCodeField, "join">, string> = { crew: "/production-access/crew", speaker: "/production-access/special-guest", sponsor: "/production-access/special-guest", vip: "/production-access/special-guest", client: "/production-access/special-guest" };

/**
 * A guest link, like the host link: the right gate with the event code and the role code
 * prefilled. The person presses Continue; nothing is submitted for them. Crew links carry
 * role=crew (the host link is the same gate with role=executive_producer).
 */
export function guestGatePath(event: Pick<RuntimeEventRecord, "joinCode" | "accessCodes">, role: Exclude<AccessCodeField, "join">) {
  const code = event.accessCodes[role];
  const query = `event=${encodeURIComponent(displayCode(event.joinCode))}&code=${encodeURIComponent(displayCode(code))}`;
  return role === "crew" ? `${GATE.crew}?${query}&role=crew` : `${GATE[role]}?${query}`;
}

/**
 * The event code is readable (16 Sep 2026, the owner's scheme): `WPL-STEM`, where STEM is the first
 * six letters/digits of the event name, uppercased ("45 Minute AI workshop" → WPL-45MINU). A name
 * that yields fewer than six characters is padded from a stable hash of the event id, and when a
 * stem is already taken by another live event the next one gets a digit: SEQUOI, SEQUOI2, SEQUOI3.
 * Every attendee holds the event code, so it is public by design.
 *
 * Role codes are secrets (22 Nov 2026). Until then they were `WPL-CREW-STEM`, `WPL-VIP-STEM` …:
 * the role word plus the public stem, so anyone holding the event code could type the crew code
 * on the first try. A role code is now the role word plus ten characters from crypto randomness
 * (`WPL-CREW-7KQ3X-M9P2T`, about 50 bits), nothing taken from the event: still readable down a
 * phone line, never worked out. Codes are shown to producers and sent in links, so they are kept
 * as written, not hashed. The old stem-built role codes are refused after LEGACY_ROLE_CODE_CUTOFF
 * (see roleCodeRetired); a producer replaces them sooner with "New codes".
 */
export const CODE_PREFIX = "WPL";
export const ROLE_SEGMENT: Record<Exclude<AccessCodeField, "join">, string> = {
  crew: "CREW",
  speaker: "SPEAKER",
  sponsor: "SPONSOR",
  client: "CLIENT",
  vip: "VIP",
};
export type RoleCodeField = Exclude<AccessCodeField, "join">;
export const ROLE_CODE_FIELDS: RoleCodeField[] = ["crew", "speaker", "sponsor", "vip", "client"];

const STEM_LENGTH = 6;
const PAD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** 32 symbols, so a byte modulo 32 is unbiased; no 0/O or 1/I to misread. */
const SECRET_ALPHABET = PAD_ALPHABET;
const ROLE_SECRET_LENGTH = 10;

/** `length` characters from the platform's cryptographic random source. */
export function randomCodeChars(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let index = 0; index < length; index += 1) out += SECRET_ALPHABET[bytes[index] % SECRET_ALPHABET.length];
  return out;
}

/** A fresh role code: WPL-CREW-7KQ3X-M9P2T. Nothing in it comes from the event. */
export function mintRoleCode(role: RoleCodeField) {
  const secret = randomCodeChars(ROLE_SECRET_LENGTH);
  return `${CODE_PREFIX}-${ROLE_SEGMENT[role]}-${secret.slice(0, 5)}-${secret.slice(5)}`;
}

/** True for a role code minted by mintRoleCode (the random shape). */
export function isRandomRoleCode(code: string | undefined | null, role: RoleCodeField) {
  return new RegExp(`^${CODE_PREFIX}-${ROLE_SEGMENT[role]}-[${SECRET_ALPHABET}]{5}-[${SECRET_ALPHABET}]{5}$`).test(String(code || "").trim().toUpperCase());
}

/**
 * Stem-built role codes (WPL-CREW-STEM) stop opening any door at this moment: end of Saturday
 * 28 Nov 2026, Central. Chosen on 22 Nov 2026 against the calendar: no event in D1 starts before
 * then (every non-archived event is a draft dated in the past), so no show loses a working link
 * mid-run, and producers have a week to press "New codes" before a draft becomes a show.
 */
export const LEGACY_ROLE_CODE_CUTOFF = "2026-11-29T06:00:00.000Z";

/**
 * The last day the stem-built codes work, as a producer reads it: the cut-off is the first moment
 * they are refused (midnight starting Sunday in Chicago), so the day named is the one before it.
 */
export function legacyRoleCodeLastDay(cutoff = LEGACY_ROLE_CODE_CUTOFF) {
  return new Date(Date.parse(cutoff) - 1).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" });
}

const ROLE_LABEL: Record<RoleCodeField, string> = { crew: "crew", speaker: "speaker", sponsor: "sponsor", vip: "VIP", client: "client" };

/** "crew, speaker, sponsor, VIP and client codes" / "VIP code", for notices. */
export function roleCodeListLabel(roles: RoleCodeField[]) {
  const names = roles.map((role) => ROLE_LABEL[role]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "";
  return `${list} code${names.length === 1 ? "" : "s"}`;
}

/** A small, stable, dependency-free hash — the same event id always pads to the same characters. */
function stableHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** The six-character stem for an event name, padded from the event id when the name is too short. */
export function codeStem(eventName: string, eventId = ""): string {
  const letters = String(eventName || "").normalize("NFKD").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (letters.length >= STEM_LENGTH) return letters.slice(0, STEM_LENGTH);
  let hash = stableHash(`${eventId || eventName || "event"}`);
  let padded = letters;
  while (padded.length < STEM_LENGTH) {
    padded += PAD_ALPHABET[hash % PAD_ALPHABET.length];
    hash = Math.floor(hash / PAD_ALPHABET.length) + 7;
  }
  return padded;
}

/** The disambiguated stem: SEQUOI, then SEQUOI2, SEQUOI3 … when earlier events already hold it. */
export function stemWithSuffix(stem: string, attempt: number) {
  return attempt <= 1 ? stem : `${stem}${attempt}`;
}

export function joinCodeForStem(stem: string) {
  return `${CODE_PREFIX}-${stem}`.toUpperCase();
}

/** The old stem-built shape, kept only to recognise (and retire) codes minted before 22 Nov 2026. */
export function stemBuiltRoleCode(stem: string, role: RoleCodeField) {
  return `${CODE_PREFIX}-${ROLE_SEGMENT[role]}-${stem}`.toUpperCase();
}

/** True when a role code is the old WPL-ROLE-STEM built from this event's own (public) event code. */
export function isBuiltFromJoinCode(code: string | undefined | null, joinCode: string | undefined | null, role: RoleCodeField) {
  const stem = stemFromCode(joinCode);
  return Boolean(stem) && codesMatch(code, stemBuiltRoleCode(stem!, role));
}

/** A stem-built role code opens nothing once the cut-off has passed; any other code is unaffected. */
export function roleCodeRetired(code: string | undefined | null, joinCode: string | undefined | null, role: RoleCodeField, now = new Date()) {
  return now.getTime() >= Date.parse(LEGACY_ROLE_CODE_CUTOFF) && isBuiltFromJoinCode(code, joinCode, role);
}

/** The role code a door may accept for this event right now: the stored one, unless it is a retired stem-built code. */
export function liveRoleCode(event: Pick<RuntimeEventRecord, "joinCode" | "accessCodes">, role: RoleCodeField, now = new Date()) {
  const code = event.accessCodes?.[role];
  if (!code || roleCodeRetired(code, event.joinCode, role, now)) return undefined;
  return code;
}

/** The stem a code carries, if it is one of ours: WPL-CREW-45MINU → 45MINU, WPL-45MINU → 45MINU. */
export function stemFromCode(code: string | undefined | null): string | undefined {
  const parts = String(code || "").trim().toUpperCase().split("-").filter(Boolean);
  if (parts.length < 2 || parts[0] !== CODE_PREFIX) return undefined;
  const last = parts[parts.length - 1];
  return last && last !== CODE_PREFIX ? last : undefined;
}



/**
 * The shapes we generated before the readable scheme: `wpl-ab12cd` join codes and
 * `CREW-93H7SD` / `SPK-…` / `SPN-…` / `VIP-…` / `CLT-…` role codes. They are ours, not somebody's
 * deliberate choice, so "adopt the readable codes" replaces them; a code that matches neither
 * shape was set by hand and is kept.
 */
export function isLegacyGeneratedCode(code: string | undefined | null, field: AccessCodeField) {
  const value = String(code || "").trim().toUpperCase();
  if (field === "join") return /^WPL-[A-Z0-9]{6}$/.test(value);
  const prefixes: Record<Exclude<AccessCodeField, "join">, string> = { crew: "CREW", speaker: "SPK", sponsor: "SPN", vip: "VIP", client: "CLT" };
  return new RegExp(`^${prefixes[field as Exclude<AccessCodeField, "join">]}-[A-Z0-9]{6}$`).test(value);
}

/** The stem an event should use: the one its codes already carry, when that still comes from its name. */
export function stemForEvent(currentJoinCode: string | undefined, eventName: string, eventId: string) {
  const current = stemFromCode(currentJoinCode);
  if (!current) return undefined;
  const base = codeStem(eventName, eventId);
  return current === base || new RegExp(`^${base}[0-9]+$`).test(current) ? current : undefined;
}
