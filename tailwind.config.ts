import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { cssVars, tailwindColors } from "./lib/theme/palette";

/**
 * Colours are CSS variables (lib/theme/palette.ts): the light values on :root, the dark values
 * under prefers-color-scheme, and the light values again inside `.wpl-as-authored` (stage and
 * video surfaces that are dark by design in both schemes).
 */
const themeVariables = plugin(({ addBase }) => {
  addBase({
    ":root": { ...cssVars("light"), "color-scheme": "light" },
    // Set on the element itself, so it beats the dark values the element would inherit from :root.
    ".wpl-as-authored": { ...cssVars("light"), "color-scheme": "light" },
    "@media (prefers-color-scheme: dark)": {
      ":root": { ...cssVars("dark"), "color-scheme": "dark" },
    },
  });
});

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: tailwindColors(),
      boxShadow: {
        brand: "0 24px 80px rgba(5, 5, 5, 0.08)",
      },
      borderRadius: {
        brand: "1.75rem",
      },
    },
  },
  plugins: [themeVariables],
};

export default config;
