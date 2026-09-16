/**
 * The instruction pages West Peek sends people to.
 *
 * An instruction email carries a LINK to one of these, never a frozen copy of it, so a correction
 * made here reaches everybody who was ever sent the link — including the people who were sent it
 * last month.
 */
export type HowItWorksAudience = "client" | "crew" | "speaker" | "sponsor" | "attendee";

export const HOW_IT_WORKS_AUDIENCES: HowItWorksAudience[] = ["client", "crew", "speaker", "sponsor", "attendee"];

export function isHowItWorksAudience(value: string): value is HowItWorksAudience {
  return (HOW_IT_WORKS_AUDIENCES as string[]).includes(value);
}

export interface HowItWorksPageRecord {
  slug: HowItWorksAudience;
  title: string;
  /** One paragraph under the title. Plain text, no markup. */
  intro: string;
  /** Markdown-lite: ## headings, - bullets, 1. numbers, paragraphs. The same renderer as /manual. */
  body: string;
  updatedBy: string;
  updatedByLabel: string;
  updatedAt: string;
}
