import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The ONE way a West Peek mark or wordmark links home.
 *
 * The owner, 17 Sep 2026: "there are plenty of instances in westpeek.live where there is a logo in
 * the upper right corner and it isn't hyperlinked to the homepage". There were twenty-odd of them.
 * Twenty-odd inline <Link> wrappers would be twenty-odd chances to lose the focus ring, the
 * accessible name, or the href — so every one of them goes through this, and
 * scripts/validate_logo_home_links.js fails the build if a brand mark is rendered outside it.
 *
 * What it guarantees at every call site:
 *  - the href is the product's own front door, written once;
 *  - a real accessible name on the LINK (the wrapped artwork is passed in decorative, so a screen
 *    reader announces the destination once rather than the artwork and then the destination);
 *  - a visible focus ring, offset against whichever surface it sits on. There is no dark theme in
 *    this product, so `inverse` means "this sits on the near-black chrome", not "dark mode".
 */

/** The product's front door. Written once; every home link in the app reads it from here. */
export const WEST_PEEK_HOME_HREF = "https://westpeek.live";

/** One accessible name, so the announcement is identical on all ~20 surfaces. */
export const WEST_PEEK_HOME_LABEL = "West Peek Live home page";

export function WestPeekHomeLink({
  inverse = false,
  radius = "rounded-lg",
  className = "",
  testId,
  children,
}: {
  inverse?: boolean;
  radius?: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={WEST_PEEK_HOME_HREF}
      aria-label={WEST_PEEK_HOME_LABEL}
      data-home-link="west-peek"
      data-testid={testId}
      className={`inline-flex shrink-0 items-center ${radius} focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-1 ${inverse ? "focus:ring-offset-brand-black" : "focus:ring-offset-white"} ${className}`}
    >
      {children}
    </Link>
  );
}
