import Image from "next/image";
import Link from "next/link";

/**
 * The West Peek monogram — the real asset, not a drawn stand-in.
 *
 * WEST_PEEK_BRAND_SYSTEM.md line 7: "Use the approved repository asset; do not fabricate substitute
 * marks." The shells used to render a CSS square with the letters WP typed into it, which is exactly
 * the fabricated mark that line forbids. This renders the artwork from the West Peek brand repo.
 *
 * It ACCOMPANIES the "West Peek Live!" wordmark, it does not replace it, for two reasons that are
 * both written down:
 *
 *  - WEST_PEEK_BRAND_SYSTEM.md lines 37-42 — the parent logo belongs in the primary shell, and a
 *    repo's own sub-brand wordmark "may accompany the logo but may not displace West Peek as the
 *    parent brand". West Peek is the parent; "West Peek Live!" is this product's wordmark. Dropping
 *    either one loses a level of the hierarchy.
 *  - BRAND_SYSTEM_WEST_PEEK_LIVE.md lines 13-22 locks the wordmark as a text-first lockup, down to
 *    the skewed orange script "Live!", and scripts/validate_branding.js lines 77-79 fails the build
 *    if that lockup stops being text. An image cannot legally stand in for it.
 *
 * Two files rather than one recoloured file: the glyph is a flat silhouette, so a white copy on the
 * near-black shells and a #050505 copy on white surfaces is exact, where a CSS filter would be a
 * guess that breaks the moment the artwork stops being one flat colour.
 */

/** Intrinsic size of both PNGs — the glyph trimmed to its alpha bounds, at 3x the largest slot. */
const INTRINSIC_WIDTH = 147;
const INTRINSIC_HEIGHT = 96;

const sizeMap = {
  /** The venue bar and the mobile shells. 16px on a phone so the chrome stack budget is unchanged. */
  sm: "h-4 w-auto sm:h-5",
  /** The workspace sidebar, where the old CSS chip sat. */
  md: "h-7 w-auto",
  lg: "h-10 w-auto",
};

export type WestPeekLogoSize = keyof typeof sizeMap;

export function WestPeekLogo({ size = "sm", inverse = false, className = "", alt = "West Peek" }: { size?: WestPeekLogoSize; inverse?: boolean; className?: string; alt?: string }) {
  return (
    <Image
      src={inverse ? "/brand/wp-mark-white.png" : "/brand/wp-mark-black.png"}
      alt={alt}
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      className={`${sizeMap[size]} shrink-0 object-contain ${className}`}
    />
  );
}

/**
 * The monogram as the way back to westpeek.live, which is the owner's ask: the logo is a hyperlink
 * to the first homepage. The focus ring is the same one BrandHomeLink uses, offset against the dark
 * shells it sits on, so a keyboard user can see where they are.
 *
 * `aria-label` carries the destination and the image's own alt is emptied, so a screen reader
 * announces the link once rather than announcing "West Peek" and then the label.
 */
export function WestPeekLogoHomeLink({ size = "sm", inverse = false, className = "" }: { size?: WestPeekLogoSize; inverse?: boolean; className?: string }) {
  return (
    <Link
      href="https://westpeek.live"
      className={`inline-flex shrink-0 items-center rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-1 ${inverse ? "focus:ring-offset-brand-black" : "focus:ring-offset-white"} ${className}`}
      aria-label="West Peek home page"
    >
      <WestPeekLogo size={size} inverse={inverse} alt="" />
    </Link>
  );
}
