import Image from "next/image";

/**
 * The wordmark. `src` is the logo uploaded in Settings when there is one — pass it through
 * <HouseLogo /> rather than resolving it here, so this stays synchronous for the error boundaries
 * and setup-failure screens that render it.
 */
export function WestPeekProductionsLogo({ size = "md", className = "", src }: { size?: "sm" | "md" | "lg"; className?: string; src?: string }) {
  const sizeClass = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-12 w-12" : "h-16 w-16";
  const pixelSize = size === "lg" ? 96 : size === "sm" ? 48 : 64;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="West Peek Productions">
      <Image
        src={src || "/brand/west-peek-productions-logo.jpg"}
        alt="West Peek Productions logo"
        width={pixelSize}
        height={pixelSize}
        priority={size === "lg"}
        unoptimized={Boolean(src)}
        className={`${sizeClass} rounded-xl bg-white object-contain`}
      />
      <span className="sr-only">West Peek Productions</span>
    </span>
  );
}
