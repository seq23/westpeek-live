/**
 * The pure part of markdown-lite: the anchors and the section list a document's spine is built
 * from. Kept out of the .tsx so it can be tested on its own.
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
      return { level: match[1].length, text, id: markdownSlug(text) };
    });
}
