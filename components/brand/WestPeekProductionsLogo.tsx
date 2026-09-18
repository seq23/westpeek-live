import Image from "next/image";
import { WestPeekHomeLink } from "@/components/brand/WestPeekHomeLink";

/**
 * The wordmark. `src` is the logo uploaded in Settings when there is one — pass it through
 * <HouseLogo /> rather than resolving it here, so this stays synchronous for the error boundaries
 * and setup-failure screens that render it.
 */
export function WestPeekProductionsLogo({ size = "md", className = "", src, decorative = false }: { size?: "sm" | "md" | "lg"; className?: string; src?: string; decorative?: boolean }) {
  const sizeClass = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-12 w-12" : "h-16 w-16";
  const pixelSize = size === "lg" ? 96 : size === "sm" ? 48 : 64;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label={decorative ? undefined : "West Peek Productions"}>
      <Image
        src={src || "/brand/west-peek-productions-logo.jpg"}
        alt={decorative ? "" : "West Peek Productions logo"}
        width={pixelSize}
        height={pixelSize}
        priority={size === "lg"}
        unoptimized={Boolean(src)}
        className={`${sizeClass} rounded-xl bg-white object-contain`}
      />
      {decorative ? null : <span className="sr-only">West Peek Productions</span>}
    </span>
  );
}

/**
 * The same logo, as the way back to westpeek.live.
 *
 * This is the crest at the top of every marketing page, every production-access gate, the operator
 * packet, the launchpad and the branded setup-failure screen — about fourteen surfaces, all of
 * which rendered it as inert artwork until the owner pointed it out on 17 Sep 2026.
 *
 * It wraps rather than replaces: `WestPeekProductionsLogo` is still the thing that renders, pixel
 * for pixel, because the brand system fixes the artwork and this change is only about the anchor
 * around it. `decorative` empties the artwork's own name so the link announces once.
 *
 * `rounded-2xl` rather than the primitive's default, because the artwork itself is `rounded-xl` —
 * the focus ring should follow the corner it is drawn around rather than cut across it.
 *
 * `inverse` is the surface under it, not a theme: the artwork is a white tile, so on the dark
 * dashboard panel the ring's offset has to be the panel rather than white, or the gap between ring
 * and tile disappears. There is no dark theme in this product.
 */
export function WestPeekProductionsLogoHomeLink({ size = "md", inverse = false, className = "" }: { size?: "sm" | "md" | "lg"; inverse?: boolean; className?: string }) {
  return (
    <WestPeekHomeLink radius="rounded-2xl" inverse={inverse} className={className}>
      <WestPeekProductionsLogo size={size} decorative />
    </WestPeekHomeLink>
  );
}
