import { WestPeekProductionsLogo, WestPeekProductionsLogoHomeLink } from "@/components/brand/WestPeekProductionsLogo";
import { getHouseDefaults } from "@/services/agencies/houseDefaultsService";
import { houseLogoUrl } from "@/services/assets/eventAssetService";

/**
 * The logo, wherever a logo is rendered: the one uploaded in Settings, or the wordmark.
 *
 * A server component rather than a prop on WestPeekProductionsLogo, because that one is rendered
 * inside error boundaries and setup-failure screens where an await would be the wrong thing to do.
 * With no logo set — or with storage unconfigured, or the signed URL refused — this is exactly the
 * wordmark that was there before.
 *
 * Only the West Peek artwork links home. A house that has uploaded its own logo is looking at its
 * own mark on a white-labelled page (the intake form, a client's proposal, its own dashboard), and
 * pointing an agency's logo at westpeek.live would send its client to the wrong company. That
 * surface keeps its way home in the "Powered by West Peek Live" line the LegalFooter already
 * carries. This exception is declared by name in scripts/validate_logo_home_links.js.
 */
export async function HouseLogo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const house = await getHouseDefaults().catch(() => undefined);
  const src = house?.logoStoragePath ? await houseLogoUrl(house.logoStoragePath).catch(() => undefined) : undefined;
  if (!src) return <WestPeekProductionsLogoHomeLink size={size} className={className} />;
  return <WestPeekProductionsLogo size={size} className={className} src={src} />;
}
