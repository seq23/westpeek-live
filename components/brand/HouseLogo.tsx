import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { getHouseDefaults } from "@/services/agencies/houseDefaultsService";
import { houseLogoUrl } from "@/services/assets/eventAssetService";

/**
 * The logo, wherever a logo is rendered: the one uploaded in Settings, or the wordmark.
 *
 * A server component rather than a prop on WestPeekProductionsLogo, because that one is rendered
 * inside error boundaries and setup-failure screens where an await would be the wrong thing to do.
 * With no logo set — or with storage unconfigured, or the signed URL refused — this is exactly the
 * wordmark that was there before.
 */
export async function HouseLogo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const house = await getHouseDefaults().catch(() => undefined);
  const src = house?.logoStoragePath ? await houseLogoUrl(house.logoStoragePath).catch(() => undefined) : undefined;
  return <WestPeekProductionsLogo size={size} className={className} src={src} />;
}
