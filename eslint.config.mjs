import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Next 16 removed `next lint`; this is the same rule set (.eslintrc.json before) on the ESLint CLI.
const config = [
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "artifacts/**", "test-results/**", "playwright-report/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      // New in eslint-plugin-react-hooks 7 (arrived with Next 16): React Compiler advice. The app does
      // not run the compiler, and the 22 sites they flag (mount-time localStorage / clock reads that
      // avoid hydration mismatches) behave correctly; kept visible as warnings, not silenced.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default config;
