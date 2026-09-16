import Link from "next/link";
import type { ReactNode } from "react";
import { markdownSlug } from "@/lib/markdown/markdownOutline";

/**
 * Markdown-lite: headings, paragraphs, lists, tables, block quotes, fenced code, images, links,
 * bold, italic and inline code. Enough for the operator manual and the instruction pages, with no
 * dependency and no raw HTML — a document is content, never markup we execute.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(!\[[^\]]*\]\([^)]+\))|(\[[^\]]+\]\([^)]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    index += 1;
    if (token.startsWith("![")) {
      const alt = token.slice(2, token.indexOf("]"));
      const src = token.slice(token.indexOf("](") + 2, -1);
      // eslint-disable-next-line @next/next/no-img-element
      nodes.push(<img key={key} src={src} alt={alt} className="my-3 w-full rounded-2xl border border-brand-line" loading="lazy" />);
    } else if (token.startsWith("[")) {
      const label = token.slice(1, token.indexOf("]"));
      const href = token.slice(token.indexOf("](") + 2, -1);
      nodes.push(href.startsWith("/") ? <Link key={key} href={href} className="font-bold underline">{label}</Link> : <a key={key} href={href} className="font-bold underline" rel="noreferrer">{label}</a>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key} className="rounded bg-brand-ash px-1 py-0.5 text-[0.9em]">{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function renderMarkdownLite(source: string): ReactNode[] {
  const lines = source.split("\n");
  const out: ReactNode[] = [];
  let index = 0;
  let key = 0;
  const sizes = ["text-3xl", "text-2xl", "text-xl", "text-lg", "text-base", "text-base"];
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) { code.push(lines[index]); index += 1; }
      index += 1;
      key += 1;
      out.push(<pre key={`code-${key}`} className="my-3 overflow-x-auto rounded-2xl bg-brand-black p-4 text-xs text-white"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const id = markdownSlug(text.replace(/[*`]/g, ""));
      key += 1;
      out.push(
        <h2 key={`h-${key}`} id={id} className={`mt-6 scroll-mt-24 font-black tracking-tight ${sizes[level - 1]}`} data-level={level}>
          {inline(text, `h-${key}`)}
        </h2>,
      );
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) { quote.push(lines[index].slice(2)); index += 1; }
      key += 1;
      out.push(<blockquote key={`q-${key}`} className="my-3 rounded-2xl border-l-4 border-brand-orange bg-brand-ash p-3 text-sm">{inline(quote.join(" "), `q-${key}`)}</blockquote>);
      continue;
    }
    if (/^\|/.test(line) && index + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[index + 1])) {
      const header = line.split("|").slice(1, -1).map((cell) => cell.trim());
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && /^\|/.test(lines[index])) { rows.push(lines[index].split("|").slice(1, -1).map((cell) => cell.trim())); index += 1; }
      key += 1;
      out.push(
        <div key={`t-${key}`} className="my-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] font-black uppercase tracking-wide text-brand-muted"><tr>{header.map((cell, position) => <th key={position} className="py-2 pr-3">{inline(cell, `th-${position}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-brand-line">{row.map((cell, cellIndex) => <td key={cellIndex} className="py-2 pr-3 align-top">{inline(cell, `td-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (index < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^(\s*)([-*]|\d+\.)\s+/, ""));
        index += 1;
      }
      key += 1;
      const listClass = `my-3 space-y-1 pl-5 text-sm ${ordered ? "list-decimal" : "list-disc"}`;
      const children = items.map((item, position) => <li key={position}>{inline(item, `li-${key}-${position}`)}</li>);
      out.push(ordered ? <ol key={`l-${key}`} className={listClass}>{children}</ol> : <ul key={`l-${key}`} className={listClass}>{children}</ul>);
      continue;
    }
    if (/^---+$/.test(line.trim())) { key += 1; out.push(<hr key={`hr-${key}`} className="my-6 border-brand-line" />); index += 1; continue; }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|\||>\s|```|---+$)/.test(lines[index]) && !/^(\s*)([-*]|\d+\.)\s+/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    key += 1;
    out.push(<p key={`p-${key}`} className="my-2 text-sm leading-6">{inline(paragraph.join(" "), `p-${key}`)}</p>);
  }
  return out;
}
