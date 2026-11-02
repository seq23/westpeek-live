/**
 * House style applied when text is rendered, never enforced by a validator: the owner does not use
 * em dashes, so readable copy shows a comma where a source (an operator's edit, a default draft)
 * wrote one. Code spans and code blocks are left exactly as written.
 */
export function swapEmDashes(text: string): string {
  return text.replace(/^\s*—\s*/gm, "").replace(/\s*—\s*/g, ", ");
}
