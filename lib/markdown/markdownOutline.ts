import { swapEmDashes } from "@/lib/presentation/houseStyle";

/**
 * The anchors and the section list a document's spine is built from. Kept out of the .tsx so it
 * can be tested on its own. The spine shows the heading in house style (no em dash), like the
 * body does; the anchor is slugged from the source text, so links stay the same.
 */
export function markdownSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface MarkdownHeading {
  level: number;
  text: string;
  id: string;
}

export function markdownHeadings(source: string): MarkdownHeading[] {
  return source
    .split("\n")
    .map((line) => /^(#{2,3})\s+(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => {
      const text = match[2].replace(/[*`]/g, "");
      return { level: match[1].length, text: swapEmDashes(text), id: markdownSlug(text) };
    });
}
