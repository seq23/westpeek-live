import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { HOW_IT_WORKS_DEFAULTS, defaultHowItWorksPage } from "./howItWorksDefaults";
import { HOW_IT_WORKS_AUDIENCES, type HowItWorksAudience, type HowItWorksPageRecord } from "@/types/howItWorks";

/**
 * The five instruction pages, read by anyone and edited by West Peek.
 *
 * An instruction email carries the LINK, never the text, so this is the only copy: correcting a
 * page here corrects it for everyone who was ever sent the link. That is the whole reason the
 * content lives in the runtime store rather than in the bundle.
 *
 * A slug with no stored row renders the first draft that ships in the code, so these pages cannot
 * be blank and do not need a database row to exist before the first email goes out.
 */
export { HOW_IT_WORKS_DEFAULTS };

export interface HowItWorksView extends HowItWorksPageRecord {
  /** True while the page is still the draft that shipped, so the editor can say so. */
  isDefault: boolean;
}

export function howItWorksPath(slug: HowItWorksAudience) {
  return `/how-it-works/${slug}`;
}

export async function readHowItWorksPage(slug: HowItWorksAudience): Promise<HowItWorksView> {
  const stored = await getRuntimeStore().getHowItWorksPage(slug).catch(() => undefined);
  if (stored) return { ...stored, isDefault: false };
  return { ...defaultHowItWorksPage(slug), isDefault: true };
}

export async function readAllHowItWorksPages(): Promise<HowItWorksView[]> {
  const stored = await getRuntimeStore().listHowItWorksPages().catch(() => [] as HowItWorksPageRecord[]);
  const byslug = new Map(stored.map((page) => [page.slug, page]));
  return HOW_IT_WORKS_AUDIENCES.map((slug) => {
    const row = byslug.get(slug);
    return row ? { ...row, isDefault: false } : { ...defaultHowItWorksPage(slug), isDefault: true };
  });
}

export type SaveHowItWorksResult =
  | { ok: true; page: HowItWorksPageRecord }
  | { ok: false; reason: string };

/**
 * Save an edit. Refuses an empty page rather than letting somebody publish a blank instruction to
 * everyone holding the link, and records who saved it so a change is never anonymous.
 */
export async function saveHowItWorksPage(input: {
  slug: HowItWorksAudience;
  title: string;
  intro: string;
  body: string;
  updatedBy: string;
  updatedByLabel: string;
}): Promise<SaveHowItWorksResult> {
  const title = input.title.trim();
  const intro = input.intro.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, reason: "The page needs a title." };
  if (body.length < 80) return { ok: false, reason: "That is too short to be an instruction page. People are reading this an hour before a show." };
  const page: HowItWorksPageRecord = {
    slug: input.slug,
    title,
    intro,
    body,
    updatedBy: input.updatedBy,
    updatedByLabel: input.updatedByLabel,
    updatedAt: new Date().toISOString(),
  };
  try {
    await getRuntimeStore().setHowItWorksPage(page);
    return { ok: true, page };
  } catch (error) {
    return { ok: false, reason: `Could not save the page: ${error instanceof Error ? error.message : String(error)}` };
  }
}
