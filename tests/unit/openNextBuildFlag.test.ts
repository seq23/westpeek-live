import fs from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * OpenNext's build refuses a Next.js major two years after its release, by today's date. Next 15
 * crossed that line on 21 Oct 2026 and every Worker build failed with no commit behind it. PR #91
 * forced the build with an override flag; the lasting fix moved the app to Next 16 and took the flag
 * out. Every OpenNext build path now runs the plain build, on a Next major OpenNext supports.
 */
const FLAG = "--dangerouslyUseUnsupportedNextVersion";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const majorOf = (v: unknown) => Number(String(v).replace(/^[^\d]*/, "").split(".")[0]);

describe("the Worker build runs on a supported Next.js, with no override", () => {
  it("next is pinned to an exact 16+ version and the lockfile agrees", () => {
    expect(pkg.dependencies.next).toMatch(/^\d+\.\d+\.\d+$/);
    expect(majorOf(pkg.dependencies.next)).toBeGreaterThanOrEqual(16);
    expect(lock.packages["node_modules/next"].version).toBe(pkg.dependencies.next);
    expect(majorOf(pkg.dependencies.react)).toBeGreaterThanOrEqual(19);
    expect(pkg.dependencies["react-dom"]).toBe(pkg.dependencies.react);
  });

  it("every OpenNext build path runs the plain build, without the override flag", () => {
    expect(pkg.scripts["cf:build"]).toBe("opennextjs-cloudflare build");
    expect(fs.readFileSync("scripts/run_recoverable_build.js", "utf8")).toMatch(/"cf:build": \["npx", \["opennextjs-cloudflare", "build"\]\]/);
    expect(fs.readFileSync("scripts/build_cloudflare_or_next.js", "utf8")).toContain("run('opennextjs-cloudflare build',");
    const buildScripts = Object.entries(pkg.scripts as Record<string, string>).filter(([, c]) => /opennextjs-cloudflare build/.test(c));
    expect(buildScripts.length).toBeGreaterThan(0);
    for (const [name, command] of Object.entries(pkg.scripts as Record<string, string>)) expect(command, name).not.toContain(FLAG);
    for (const file of ["scripts/run_recoverable_build.js", "scripts/build_cloudflare_or_next.js"]) {
      expect(fs.readFileSync(file, "utf8"), file).not.toContain(FLAG);
    }
  });

  it("the floor guard is wired into the release gate", () => {
    expect(pkg.scripts["validate:next-version-floor"]).toBe("node scripts/validate_next_version_floor.mjs");
    expect(pkg.scripts["validate:v5-hard"]).toContain("npm run validate:next-version-floor");
  });
});
