/**
 * The colour tokens, light and dark, from one table.
 *
 * Every colour class in the app (`bg-white`, `text-slate-600`, `bg-amber-50`, `text-brand-black`…)
 * resolves to a CSS variable, and the variable has a light value and a dark value. The app was
 * written light-only with ~140 colour classes over 320 files; making each one carry a `dark:` twin
 * would be 2,000 edits that drift. Swapping the values under one media query keeps every
 * screen's pairings (dark text on a pale wash, light text on a dark button) the right way round.
 *
 * Dark, per the house rules: warm near-black ground, cream ink, a brighter orange, soft colour
 * text on a deep wash of the same hue. Neutrals take a warm scale (not the cool slate) so the
 * whole app reads as one warm room. Hues flip their own Tailwind scale (50 <-> 950), which keeps
 * each "pale wash + dark text" pair a "deep wash + light text" pair.
 *
 * `black` is not themed: it is only used for video, stage overlays and scrims, which stay dark.
 * A dark-by-design surface whose children were written against light tokens (white text on a
 * black stage) carries `wpl-as-authored`, which puts the light values back inside it.
 */
import colors from "tailwindcss/colors";

const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
type Shade = (typeof SHADES)[number];

/** Hue families the app uses; each flips its own scale in the dark. */
export const HUE_FAMILIES = ["red", "orange", "amber", "emerald", "green", "sky", "cyan", "rose"] as const;

/** Warm neutral scale for the dark: ground sits between 50 and 100, ink at 950. */
const WARM_DARK: Record<Shade, string> = {
  "50": "#1d1915",
  "100": "#26211b",
  "200": "#3a332a",
  "300": "#4b4237",
  "400": "#857a6b",
  "500": "#9c9182",
  "600": "#b3a897",
  "700": "#cbc1b1",
  "800": "#ddd5c7",
  "900": "#e9e2d6",
  "950": "#f2ece2",
};

export const BRAND_LIGHT = {
  black: "#050505",
  white: "#ffffff",
  charcoal: "#171717",
  ash: "#f5f3ef",
  line: "#e7e3dc",
  muted: "#73706a",
  orange: "#f05a1a",
  orangeSoft: "#fff1e9",
} as const;

export const BRAND_DARK: Record<keyof typeof BRAND_LIGHT, string> = {
  black: "#f2ece2",
  white: "#201c17",
  charcoal: "#e9e2d6",
  ash: "#16130f",
  line: "#3a332a",
  muted: "#b3a897",
  orange: "#ff7a3d",
  orangeSoft: "#3a2216",
};

function flip(shade: Shade): Shade {
  if (shade === "50") return "950";
  if (shade === "950") return "50";
  return String(1000 - Number(shade)) as Shade;
}

function rgb(hex: string) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(" ");
}

type Token = { name: string; light: string; dark: string };

/** Every themed token: `--c-<name>` holds "r g b" so Tailwind's opacity modifiers keep working. */
export function themeTokens(): Token[] {
  const tokens: Token[] = [{ name: "white", light: "#ffffff", dark: BRAND_DARK.white }];
  for (const key of Object.keys(BRAND_LIGHT) as (keyof typeof BRAND_LIGHT)[]) {
    tokens.push({ name: `brand-${key}`, light: BRAND_LIGHT[key], dark: BRAND_DARK[key] });
  }
  for (const shade of SHADES) {
    tokens.push({ name: `slate-${shade}`, light: colors.slate[shade], dark: WARM_DARK[shade] });
  }
  for (const family of HUE_FAMILIES) {
    for (const shade of SHADES) tokens.push({ name: `${family}-${shade}`, light: colors[family][shade], dark: colors[family][flip(shade)] });
  }
  return tokens;
}

/** The value a token resolves to in a scheme: what a test compares, and what the CSS sets. */
export function tokenHex(name: string, scheme: "light" | "dark") {
  const token = themeTokens().find((t) => t.name === name);
  if (!token) throw new Error(`no colour token ${name}`);
  return scheme === "light" ? token.light : token.dark;
}

export function cssVars(scheme: "light" | "dark") {
  return Object.fromEntries(themeTokens().map((t) => [`--c-${t.name}`, rgb(scheme === "light" ? t.light : t.dark)]));
}

const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** The `theme.extend.colors` block: the same names as before, now pointing at the variables. */
export function tailwindColors() {
  const scale = (family: string) => Object.fromEntries(SHADES.map((s) => [s, v(`${family}-${s}`)]));
  return {
    white: v("white"),
    brand: Object.fromEntries(Object.keys(BRAND_LIGHT).map((k) => [k, v(`brand-${k}`)])),
    slate: scale("slate"),
    ...Object.fromEntries(HUE_FAMILIES.map((f) => [f, scale(f)])),
  };
}
