import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require("../../next.config.js");

type Rule = { source: string; headers: Array<{ key: string; value: string }> };

/** Every page gets HSTS and the page-wide CSP; the signed file route keeps only its own sandbox CSP. */
describe("security headers", () => {
  it("cover every path except /api/assets/file", async () => {
    const rules: Rule[] = await nextConfig.headers();
    const matches = (path: string) => rules.filter((rule) => new RegExp(`^${rule.source.replace(/\(\?!/g, "(?!")}$`).test(path));
    for (const path of ["/", "/login", "/venue/evt-1/lobby", "/app/events/evt-1/assets", "/api/assets/upload", "/api/assets/evt/download"]) {
      const headers = Object.fromEntries(matches(path).flatMap((rule) => rule.headers.map((h) => [h.key, h.value])));
      expect(headers["Strict-Transport-Security"], path).toMatch(/^max-age=31536000/);
      expect(headers["Content-Security-Policy"], path).toContain("frame-ancestors 'self'");
      expect(headers["Content-Security-Policy"], path).toContain("object-src 'none'");
    }
    expect(matches("/api/assets/file")).toEqual([]);
  });

  it("names no script or connect origins that would break a video room", () => {
    const csp = nextConfig.SECURITY_HEADERS.find((h: { key: string }) => h.key === "Content-Security-Policy").value as string;
    expect(csp).not.toMatch(/(default|script|connect|frame|media|img)-src/);
  });
});
