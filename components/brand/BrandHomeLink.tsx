import { WestPeekHomeLink } from "@/components/brand/WestPeekHomeLink";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";

type BrandHomeLinkProps = {
  size?: "sm" | "md" | "lg";
  inverse?: boolean;
  className?: string;
};

/**
 * The wordmark as the way home, for the surfaces whose crest is the wordmark rather than the
 * monogram (the legal pages, the workspace top bar on a phone).
 *
 * It routes through WestPeekHomeLink like every other home link in the app, so the href, the
 * accessible name and the focus ring are the same ones the monogram link uses. `radius` is the only
 * thing it changes: a pill, because the wordmark is wider than it is tall.
 *
 * The wordmark is passed `decorative`, which drops its own aria-label — the link already carries
 * the name, and two names on one control is announced twice.
 */
export function BrandHomeLink({ size = "md", inverse = false, className = "" }: BrandHomeLinkProps) {
  return (
    <WestPeekHomeLink inverse={inverse} radius="rounded-full" className={className}>
      <WestPeekLiveWordmark size={size} inverse={inverse} decorative />
    </WestPeekHomeLink>
  );
}
