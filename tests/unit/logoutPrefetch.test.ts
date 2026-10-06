import { describe, expect, it } from "vitest";
import { GET } from "@/app/production-access/logout/route";
import { isPrefetchRequest } from "@/lib/http/prefetch";

/**
 * A production <Link> prefetch of /production-access/logout used to log the operator out the moment
 * the launchpad rendered (6 Oct 2026). A prefetch must change no cookie; a real click must clear all four.
 */
describe("logout ignores prefetches", () => {
  it("recognises the router and browser prefetch headers, and nothing else", () => {
    expect(isPrefetchRequest(new Headers({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "x-middleware-prefetch": "1" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ rsc: "1" }))).toBe(false);
    expect(isPrefetchRequest(new Headers())).toBe(false);
  });

  it("a prefetch gets a 204 and no Set-Cookie", async () => {
    const response = await GET(new Request("http://localhost:3000/production-access/logout", { headers: { "next-router-prefetch": "1", rsc: "1" } }));
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("a real navigation redirects to the doors and clears every access cookie", async () => {
    const response = await GET(new Request("http://localhost:3000/production-access/logout"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/production-access");
    const cleared = response.headers.getSetCookie().map((cookie) => cookie.split("=")[0]);
    expect(cleared).toHaveLength(4);
    expect(new Set(cleared).size).toBe(4);
  });
});
