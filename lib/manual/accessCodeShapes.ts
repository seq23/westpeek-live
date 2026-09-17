/**
 * What an access code looks like, so nothing that carries one can be handed to anybody.
 *
 * These shapes were inside scripts/validate_manual_in_app.js, which checked the manual on disk and
 * the module generated from it. The manual is now downloadable as Markdown from Assets, and a file
 * generated at click time is a third copy the validator never sees — so the shapes live here, the
 * download runs them before it serves a byte, and the validator reads this list rather than keeping
 * a second one that could drift.
 *
 * The allowance is for the manual's own worked examples: it explains how a stem becomes a code, and
 * those illustrations are not codes.
 */
export const ACCESS_CODE_SHAPES: RegExp[] = [
  /\bWPL-[A-Z0-9]{4,}/,
  /\bCREW-[A-Z0-9]{6}/,
  /\bSPK-[A-Z0-9]{6}/,
  /\bSPN-[A-Z0-9]{6}/,
  /\bCLT-[A-Z0-9]{6}/,
  /\bVIP-[A-Z0-9]{6}/,
];

/** Placeholders the manual uses to explain the shape of a code without being one. */
export const ACCESS_CODE_PLACEHOLDERS = /STEM|ROLE|45MINU|XXXX|EXAMPL/;

export const PASSWORD_SHAPE = /PASSWORD\s*[:=]\s*\S/;

/** The first code-shaped thing in this text, or undefined. Used by the validator and the download. */
export function findAccessCodeShape(body: string): string | undefined {
  for (const shape of ACCESS_CODE_SHAPES) {
    const match = shape.exec(body);
    if (match && !ACCESS_CODE_PLACEHOLDERS.test(match[0])) return match[0];
  }
  if (PASSWORD_SHAPE.test(body)) return "a password value";
  return undefined;
}
