type WordmarkProps = {
  size?: "sm" | "md" | "lg";
  inverse?: boolean;
  className?: string;
  /**
   * Set when the wordmark is the content of a link that already carries the accessible name.
   * It only drops the redundant aria-label; nothing about what renders changes.
   */
  decorative?: boolean;
};

const sizeMap = {
  sm: {
    west: "text-lg",
    live: "text-xl",
    gap: "gap-1",
  },
  md: {
    west: "text-2xl",
    live: "text-3xl",
    gap: "gap-2",
  },
  lg: {
    west: "text-5xl sm:text-6xl",
    live: "text-5xl sm:text-6xl",
    gap: "gap-3",
  },
};

export function WestPeekLiveWordmark({ size = "md", inverse = false, className = "", decorative = false }: WordmarkProps) {
  const sizes = sizeMap[size];

  return (
    <span
      className={`inline-flex items-baseline ${sizes.gap} whitespace-nowrap leading-none ${className}`}
      aria-label={decorative ? undefined : "West Peek Live!"}
    >
      <span className={`${sizes.west} font-black tracking-[-0.06em] ${inverse ? "text-white" : "text-brand-black"}`}>
        West Peek
      </span>
      <span
        className={`${sizes.live} brand-script inline-block -translate-y-[-0.28em] -rotate-6 text-brand-orange drop-shadow-sm`}
      >
        Live!
      </span>
    </span>
  );
}
