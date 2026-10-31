import fs from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * OpenNext's build refuses a Next.js major two years after its release, by today's date. Next 15
 * crossed that line on 21 Oct 2026 and every Worker build failed with no commit behind it. Every
 * path that runs the OpenNext build must carry the override while the app is on Next < 16.
 */
const FLAG = "--dangerouslyUseUnsupportedNextVersion";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const nextMajor = Number(String(pkg.dependencies?.next || pkg.devDependencies?.next).replace(/^[^\d]*/, "").split(".")[0]);

describe("the Worker build survives OpenNext's Next.js support cut-off", () => {
  it("every OpenNext build path carries the override while next is below 16", () => {
    expect(nextMajor).toBeGreaterThan(0);
    if (nextMajor >= 16) return;
    expect(pkg.scripts["cf:build"]).toContain(FLAG);
    expect(fs.readFileSync("scripts/run_recoverable_build.js", "utf8")).toMatch(/"cf:build": \["npx", \["opennextjs-cloudflare", "build", "--dangerouslyUseUnsupportedNextVersion"\]\]/);
    expect(fs.readFileSync("scripts/build_cloudflare_or_next.js", "utf8")).toContain("run(`opennextjs-cloudflare build ${OPENNEXT_BUILD_FLAGS}`");
    for (const [name, command] of Object.entries(pkg.scripts as Record<string, string>)) {
      if (/opennextjs-cloudflare build/.test(command)) expect(command, name).toContain(FLAG);
    }
  });
});
