import { MANUAL_SOURCE } from "@/lib/manual/manualSource.generated";
import { findAccessCodeShape } from "@/lib/manual/accessCodeShapes";
import { readHowItWorksPage } from "@/services/content/howItWorksService";
import { HOW_IT_WORKS_DEFAULTS } from "@/services/content/howItWorksDefaults";
import { HOW_IT_WORKS_AUDIENCES, type HowItWorksAudience } from "@/types/howItWorks";

/**
 * The West Peek documents: the operator manual, and the five instruction pages clients are sent to.
 *
 * These are DOCUMENTS, not uploads, and the difference is structural rather than a flag on a row.
 * They are not EventAssetRecords, they never touch the asset store, and they belong to no event —
 * so there is nothing to archive, nothing to delete, and nothing that could show up in an event's
 * asset count. The Assets page lists them in their own group because that is where the owner looks
 * for "the file I hand somebody", but they share no code path with the files people upload.
 *
 * The five instruction pages are edited in the runtime store, and an instruction email carries the
 * LINK rather than the text precisely so a correction reaches everyone. A download of a page is
 * therefore generated from the live content at the moment it is clicked; a copy written to disk
 * would be the stale text the whole design exists to avoid. The manual is the one exception: it
 * lives in the repo, so its Markdown comes from the module the build generates from the file.
 */
export type WestPeekDocumentId = "operator-manual" | `how-it-works-${HowItWorksAudience}`;

export interface WestPeekDocument {
  id: WestPeekDocumentId;
  title: string;
  /** One line: what it is and who reads it. */
  gist: string;
  /** Where the content lives, in words, so the row is honest about staleness. */
  source: string;
  /** The page a reader can open instead of downloading. */
  viewPath: string;
  fileName: string;
}

export const WEST_PEEK_DOCUMENTS: WestPeekDocument[] = [
  {
    id: "operator-manual",
    title: "Operator manual",
    gist: "How West Peek Live is run, end to end. For you, an operator, or anybody you bring on.",
    source: "docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md, generated into the app at build time",
    viewPath: "/manual",
    fileName: "west-peek-operator-manual.md",
  },
  ...HOW_IT_WORKS_AUDIENCES.map((audience) => ({
    id: `how-it-works-${audience}` as WestPeekDocumentId,
    title: HOW_IT_WORKS_DEFAULTS[audience].title,
    gist: `${HOW_IT_WORKS_DEFAULTS[audience].audienceLabel} — the instructions the ${audience} link goes to.`,
    source: "the runtime store, edited on the page itself",
    viewPath: `/how-it-works/${audience}`,
    fileName: `west-peek-how-it-works-${audience}.md`,
  })),
];

export function findWestPeekDocument(id: string) {
  return WEST_PEEK_DOCUMENTS.find((document) => document.id === id);
}

export type DocumentMarkdownResult = { ok: true; markdown: string } | { ok: false; reason: string };

/**
 * The document's Markdown, as it stands right now.
 *
 * The manual goes through the same access-code check the manual validator applies to the file and
 * the generated module, because a download is a third copy and the promise — the manual never
 * carries codes — has to hold for the copy somebody actually walks away with.
 */
export async function renderWestPeekDocument(id: string): Promise<DocumentMarkdownResult> {
  const document = findWestPeekDocument(id);
  if (!document) return { ok: false, reason: "That is not one of the West Peek documents." };

  if (document.id === "operator-manual") {
    const found = findAccessCodeShape(MANUAL_SOURCE);
    if (found) return { ok: false, reason: `The manual carries something code-shaped (${found}) and will not be handed out until it does not. Fix docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md.` };
    return { ok: true, markdown: MANUAL_SOURCE };
  }

  const audience = document.id.replace("how-it-works-", "") as HowItWorksAudience;
  const page = await readHowItWorksPage(audience);
  const markdown = [
    `# ${page.title}`,
    "",
    page.intro,
    "",
    page.body.trim(),
    "",
    "---",
    "",
    `Read the live version at /how-it-works/${audience}. That page is the one an instruction email links to, so it is always current; this file is a copy taken on ${new Date().toISOString().slice(0, 10)}.`,
  ].join("\n");
  return { ok: true, markdown };
}

export function documentDownloadPath(id: WestPeekDocumentId) {
  return `/api/documents/${id}/download`;
}
