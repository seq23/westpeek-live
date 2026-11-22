import { test, expect } from "./fixtures";
import registry from "@/data/testing/cta-promise-registry.json";

test("CTA promise registry prevents public surprise routes and covers protected auth disclosure", async () => {
  for (const cta of registry.ctas) {
    const publicSource = cta.sourceRoute.startsWith("/") && !cta.sourceRoute.startsWith("/production-access") && !cta.sourceRoute.startsWith("/admin");
    const protectedTarget = cta.href.startsWith("/app") || cta.href.startsWith("/admin");
    expect(publicSource && protectedTarget && !cta.requiresAuthDisclosure, `${cta.ctaText} must not surprise-route public visitors`).toBeFalsy();
    if (protectedTarget) expect(cta.authExpectation).toMatch(/auth|login|admin|workspace|operator/i);
  }
});

test("CTA promise registry contains crew, attendee, public, protected, and hidden route outcomes", async () => {
  const text = JSON.stringify(registry).toLowerCase();
  for (const token of ["public", "protected", "auth", "crew", "attendee", "hidden"]) {
    expect(text).toContain(token);
  }
});
