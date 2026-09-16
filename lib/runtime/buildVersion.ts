/**
 * Build-version watchdog, pure part. `CURRENT_BUILD_ID` is inlined at build time into both the
 * client bundle and the Worker (next.config.js), so a page can compare what it loaded with against
 * what the server answers on the polls it already makes. Different → a new version is live.
 */
export const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export function buildChanged(loadedWith: string | null | undefined, serverSays: string | null | undefined) {
  return Boolean(loadedWith && serverSays && loadedWith !== serverSays);
}

/** Never reload mid-typing: any chat input or textarea with text in it defers the reload. */
export interface TypingFields { querySelectorAll(selector: string): ArrayLike<{ value?: string }> }

export function typingInProgress(doc: TypingFields) {
  const fields = Array.from(doc.querySelectorAll('input[name="message"], textarea'));
  return fields.some((field) => (field.value || "").trim().length > 0);
}
