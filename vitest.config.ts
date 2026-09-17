import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["tests/unit/setupEnv.ts"],
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**", ".open-next/**", "coverage/**"],
  },
  // tsconfig keeps jsx: "preserve" for Next's own build, so vite is told here how to compile the
  // .tsx a test imports. Without it a test that renders a server component cannot even parse it.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
