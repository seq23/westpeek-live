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
