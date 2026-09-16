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

export function codesMatch(a: string | undefined | null, b: string | undefined | null) {
  const left = codeKey(a);
  return left.length > 0 && left === codeKey(b);
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
 * Readable codes (16 Sep 2026, the owner's scheme). Every code for an event is
 * `WPL-[ROLE-]STEM`, where STEM is the first six letters/digits of the event name, uppercased:
 *
 *   "45 Minute AI workshop" → WPL-45MINU · WPL-CREW-45MINU · WPL-SPEAKER-45MINU ·
 *                             WPL-SPONSOR-45MINU · WPL-CLIENT-45MINU · WPL-VIP-45MINU
 *
 * One stem to remember per event, the role right there in the code. A name that yields fewer than
 * six characters is padded from a stable hash of the event id (never a short stem), and when a stem
 * is already taken by another live event the next one gets a digit: SEQUOI, SEQUOI2, SEQUOI3.
 *
 * These are derivable from a public event name on purpose; the protection is at the gate (attempt
 * limits and logged failures), not in an unreadable code.
 */
export const CODE_PREFIX = "WPL";
export const ROLE_SEGMENT: Record<Exclude<AccessCodeField, "join">, string> = {
  crew: "CREW",
  speaker: "SPEAKER",
  sponsor: "SPONSOR",
  client: "CLIENT",
  vip: "VIP",
};

const STEM_LENGTH = 6;
const PAD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

export function roleCodeForStem(stem: string, role: Exclude<AccessCodeField, "join">) {
  return `${CODE_PREFIX}-${ROLE_SEGMENT[role]}-${stem}`.toUpperCase();
}

export interface DerivedCodes {
  stem: string;
  join: string;
  crew: string;
  speaker: string;
  sponsor: string;
  vip: string;
  client: string;
}

export function derivedCodes(stem: string): DerivedCodes {
  return {
    stem,
    join: joinCodeForStem(stem),
    crew: roleCodeForStem(stem, "crew"),
    speaker: roleCodeForStem(stem, "speaker"),
    sponsor: roleCodeForStem(stem, "sponsor"),
    vip: roleCodeForStem(stem, "vip"),
    client: roleCodeForStem(stem, "client"),
  };
}

/** The stem a code carries, if it is one of ours: WPL-CREW-45MINU → 45MINU, WPL-45MINU → 45MINU. */
export function stemFromCode(code: string | undefined | null): string | undefined {
  const parts = String(code || "").trim().toUpperCase().split("-").filter(Boolean);
  if (parts.length < 2 || parts[0] !== CODE_PREFIX) return undefined;
  const last = parts[parts.length - 1];
  return last && last !== CODE_PREFIX ? last : undefined;
}

/** True when the code is exactly what this stem and role would produce (a code nobody has customised). */
export function isDerivedCode(code: string | undefined | null, stem: string, role: AccessCodeField) {
  const expected = role === "join" ? joinCodeForStem(stem) : roleCodeForStem(stem, role);
  return codesMatch(code, expected);
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
