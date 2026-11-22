import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownSlug } from "@/lib/markdown/markdownOutline";
import { swapEmDashes } from "@/lib/presentation/houseStyle";

/**
 * The operator manual and the how-it-works pages, rendered by react-markdown with GitHub tables.
 * Raw HTML in a document is shown as text, never run: react-markdown does not parse it unless a
 * rehype-raw plugin is added, and none is. House style (no em dashes) is applied to prose at render
 * time; code is left exactly as written.
 */
type MdNode = { type: string; value?: string; children?: MdNode[] };

function remarkSwapEmDashes() {
  const walk = (node: MdNode) => {
    if (node.type === "text" && typeof node.value === "string") node.value = swapEmDashes(node.value);
    if (node.type === "code" || node.type === "inlineCode") return;
    node.children?.forEach(walk);
  };
  return (tree: MdNode) => walk(tree);
}

function textOf(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children && typeof children === "object" && "props" in children) return textOf((children as { props: { children?: ReactNode } }).props.children);
  return "";
}

const sizes = ["text-3xl", "text-2xl", "text-xl", "text-lg", "text-base", "text-base"];
function heading(level: number): Components["h1"] {
  // Every heading is an h2 under the page's own h1; data-level carries the document's level.
  return function Heading({ children }) {
    return <h2 id={markdownSlug(textOf(children))} className={`mt-6 scroll-mt-24 font-black tracking-tight ${sizes[level - 1]}`} data-level={level}>{children}</h2>;
  };
}

const components: Components = {
  h1: heading(1), h2: heading(2), h3: heading(3), h4: heading(4), h5: heading(5), h6: heading(6),
  p: ({ children }) => <p className="my-2 text-sm leading-6">{children}</p>,
  a: ({ href = "", children }) => (href.startsWith("/") ? <Link href={href} className="font-bold underline">{children}</Link> : <a href={href} className="font-bold underline" rel="noreferrer">{children}</a>),
  // eslint-disable-next-line @next/next/no-img-element
  img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt || ""} className="my-3 w-full rounded-2xl border border-brand-line" loading="lazy" />,
  blockquote: ({ children }) => <blockquote className="my-3 rounded-2xl border-l-4 border-brand-orange bg-brand-ash p-3 text-sm">{children}</blockquote>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5 text-sm">{children}</ol>,
  hr: () => <hr className="my-6 border-brand-line" />,
  pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-2xl bg-brand-black p-4 text-xs text-white">{children}</pre>,
  code: ({ className, children }) => (className ? <code className={className}>{children}</code> : <code className="rounded bg-brand-ash px-1 py-0.5 text-[0.9em]">{children}</code>),
  table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full text-left text-sm">{children}</table></div>,
  thead: ({ children }) => <thead className="text-[11px] font-black uppercase tracking-wide text-brand-muted">{children}</thead>,
  th: ({ children }) => <th className="py-2 pr-3">{children}</th>,
  tr: ({ children }) => <tr className="border-t border-brand-line">{children}</tr>,
  td: ({ children }) => <td className="py-2 pr-3 align-top">{children}</td>,
};

export function Markdown({ source }: { source: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkSwapEmDashes]} components={components}>{source}</ReactMarkdown>;
}
