import colors from "tailwindcss/colors";
import { describe, expect, it } from "vitest";
import { HUE_FAMILIES, cssVars, tokenHex } from "@/lib/theme/palette";

/**
 * The dark scheme flips every colour token; these are the pairings the app actually uses (counted
 * from the class names on 22 Nov 2026), read in BOTH schemes. A pairing that is legible in light
 * and unreadable in dark is exactly the bug a token swap can introduce, so each is held to the
 * WCAG AA body-text ratio, 4.5:1, in the dark.
 */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [text: string, ground: string][] = [
  ["brand-black", "brand-ash"], ["brand-black", "white"], ["brand-muted", "white"], ["brand-muted", "brand-ash"],
  ["slate-950", "white"], ["slate-700", "white"], ["slate-600", "white"], ["slate-600", "slate-50"], ["slate-500", "white"],
  ["white", "brand-black"], ["white", "slate-950"], ["white", "slate-900"], ["brand-white", "brand-black"],
  ["brand-orange", "white"], ["brand-black", "brand-orangeSoft"],
  ...HUE_FAMILIES.flatMap((f) => [[`${f}-900`, `${f}-50`], [`${f}-800`, `${f}-50`], [`${f}-900`, `${f}-100`]] as [string, string][]),
];

describe("colour tokens, light and dark", () => {
  it("the dark ground is a warm near-black with cream ink, not the light design", () => {
    expect(luminance(tokenHex("brand-ash", "dark"))).toBeLessThan(0.02);
    expect(luminance(tokenHex("white", "dark"))).toBeLessThan(0.03);
    expect(luminance(tokenHex("brand-black", "dark"))).toBeGreaterThan(0.75);
    const [r, , b] = [1, 3, 5].map((i) => parseInt(tokenHex("brand-ash", "dark").slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b); // warm, not blue-black
  });

  it.each(PAIRS)("%s on %s stays readable in the dark (4.5:1)", (text, ground) => {
    expect(contrast(tokenHex(text, "dark"), tokenHex(ground, "dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it("the light scheme is the design as it was: Tailwind's own values and the brand hexes", () => {
    for (const shade of ["50", "200", "600", "950"] as const) expect(tokenHex(`slate-${shade}`, "light")).toBe(colors.slate[shade]);
    for (const shade of ["50", "900"] as const) expect(tokenHex(`amber-${shade}`, "light")).toBe(colors.amber[shade]);
    expect(tokenHex("white", "light")).toBe("#ffffff");
    expect(tokenHex("brand-black", "light")).toBe("#050505");
    expect(tokenHex("brand-orange", "light")).toBe("#f05a1a");
  });

  it("every token has both values and the CSS carries the same set", () => {
    const light = cssVars("light");
    const dark = cssVars("dark");
    expect(Object.keys(light).length).toBeGreaterThan(100);
    expect(Object.keys(dark)).toEqual(Object.keys(light));
    for (const value of [...Object.values(light), ...Object.values(dark)]) expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });
});
